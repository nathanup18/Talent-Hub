import { Router, type IRouter } from "express";
import { eq, and, sql, notInArray } from "drizzle-orm";
import { db, teProspectiveCacheTable, teInterestsTable, usersTable } from "@workspace/db";
import { requireAuth, requireVerified } from "../middlewares/auth";
import { z } from "zod";
import { mapBridgeCandidate, type BridgeCandidate } from "../lib/te-sync";

const router: IRouter = Router();

function paramStr(p: string | string[]): string {
  return Array.isArray(p) ? p[0] : p;
}

// GET /prospective — list anonymized TE candidates at 1st Screen stage
router.get(
  "/prospective",
  requireAuth,
  async (req, res): Promise<void> => {
    const founderId = req.session.userId!;

    const allCandidates = await db.select().from(teProspectiveCacheTable);

    // Deduplicate by roleCategory — one listing per role.
    // For TE-sourced entries, keep the most recently synced one per category
    // and count how many others in that category are hidden behind it.
    // Manual entries (MANUAL- prefix) are always kept individually.
    const seen = new Map<string, typeof allCandidates[0]>();
    const categoryCount = new Map<string, number>();
    // Seniority mix within each category, so founders can see the range of
    // levels sitting behind a single deduped listing.
    const senioritiesByCategory = new Map<string, Map<string, number>>();
    for (const c of allCandidates) {
      if (c.teId.startsWith("MANUAL-")) continue; // handled separately
      categoryCount.set(c.roleCategory, (categoryCount.get(c.roleCategory) ?? 0) + 1);
      const bySeniority =
        senioritiesByCategory.get(c.roleCategory) ?? new Map<string, number>();
      const level = c.seniority || "Unspecified";
      bySeniority.set(level, (bySeniority.get(level) ?? 0) + 1);
      senioritiesByCategory.set(c.roleCategory, bySeniority);
      const existing = seen.get(c.roleCategory);
      if (!existing || c.lastSyncedAt > existing.lastSyncedAt) {
        seen.set(c.roleCategory, c);
      }
    }
    const manuals = allCandidates.filter((c) => c.teId.startsWith("MANUAL-"));
    const candidates = [...seen.values(), ...manuals];

    // How many additional candidates sit behind each shown listing.
    const moreInCategoryFor = (c: typeof allCandidates[0]): number =>
      c.teId.startsWith("MANUAL-") ? 0 : Math.max(0, (categoryCount.get(c.roleCategory) ?? 1) - 1);

    // The seniority breakdown for a category, highest level first.
    const SENIORITY_ORDER = ["C-level", "VP", "Director", "Manager", "IC"];
    const seniorityMixFor = (c: typeof allCandidates[0]): { seniority: string; count: number }[] => {
      if (c.teId.startsWith("MANUAL-")) return [];
      const mix = senioritiesByCategory.get(c.roleCategory);
      if (!mix) return [];
      return [...mix.entries()]
        .map(([seniority, count]) => ({ seniority, count }))
        .sort((a, b) => {
          const ai = SENIORITY_ORDER.indexOf(a.seniority);
          const bi = SENIORITY_ORDER.indexOf(b.seniority);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
    };

    const interests = await db
      .select({ teId: teInterestsTable.teId })
      .from(teInterestsTable)
      .where(eq(teInterestsTable.founderId, founderId));
    const interestedIds = new Set(interests.map((i) => i.teId));

    res.json(
      candidates.map((c) => ({
        teId: c.teId,
        anonymizedHeadline: c.anonymizedHeadline,
        roleCategory: c.roleCategory,
        seniority: c.seniority,
        location: c.location,
        topSkills: c.topSkills,
        summaryBlurb: c.summaryBlurb,
        educationLevel: c.educationLevel,
        yearsExperienceEstimate: c.yearsExperienceEstimate,
        compExpectation: c.compExpectation,
        hasExpressedInterest: interestedIds.has(c.teId),
        lastSyncedAt: c.lastSyncedAt,
        screeningDate: c.screeningDate,
        moreInCategory: moreInCategoryFor(c),
        seniorityMix: seniorityMixFor(c),
      }))
    );
  }
);

// POST /prospective/:teId/interest — express interest in a prospective candidate
router.post(
  "/prospective/:teId/interest",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const teId = paramStr(req.params.teId);
    const founderId = req.session.userId!;
    const noteSchema = z.object({ note: z.string().max(500).optional() });
    const { note } = noteSchema.parse(req.body);

    const [candidate] = await db
      .select()
      .from(teProspectiveCacheTable)
      .where(eq(teProspectiveCacheTable.teId, teId));

    if (!candidate) {
      res.status(404).json({ error: "Prospective candidate not found" });
      return;
    }

    await db
      .insert(teInterestsTable)
      .values({ teId, founderId, note: note ?? null })
      .onConflictDoUpdate({
        target: [teInterestsTable.teId, teInterestsTable.founderId],
        set: { note: note ?? null, expressedAt: sql`now()` },
      });

    res.status(201).json({ success: true, teId, hasExpressedInterest: true });

    // Fire Zapier webhook — non-blocking
    const zapierUrl = process.env.ZAPIER_INTRO_REQUEST_WEBHOOK_URL;
    if (zapierUrl) {
      const [founder] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, founderId));

      fetch(zapierUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "Prospective Interest",
          founderName: founder?.name ?? "",
          founderEmail: founder?.email ?? "",
          founderCompany: founder?.company ?? "",
          candidateHeadline: candidate.anonymizedHeadline,
          candidateRoleCategory: candidate.roleCategory,
          note: note ?? "",
          requestedAt: new Date(),
        }),
      }).catch((err) => {
        console.error("[zapier] prospective webhook failed:", err);
      });
    }
  }
);

// DELETE /prospective/:teId/interest — withdraw interest
router.delete(
  "/prospective/:teId/interest",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const teId = paramStr(req.params.teId);
    const founderId = req.session.userId!;

    await db
      .delete(teInterestsTable)
      .where(
        and(
          eq(teInterestsTable.teId, teId),
          eq(teInterestsTable.founderId, founderId)
        )
      );

    res.json({ success: true, teId, hasExpressedInterest: false });
  }
);

// GET /admin/prospective-interests — admin view of all expressed interests
router.get(
  "/admin/prospective-interests",
  requireAuth,
  async (req, res): Promise<void> => {
    if (req.session.userRole !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const interests = await db
      .select({
        id: teInterestsTable.id,
        teId: teInterestsTable.teId,
        candidateHeadline: teProspectiveCacheTable.anonymizedHeadline,
        candidateRoleCategory: teProspectiveCacheTable.roleCategory,
        founderId: teInterestsTable.founderId,
        founderName: usersTable.name,
        founderEmail: usersTable.email,
        founderCompany: usersTable.company,
        note: teInterestsTable.note,
        expressedAt: teInterestsTable.expressedAt,
      })
      .from(teInterestsTable)
      .innerJoin(
        teProspectiveCacheTable,
        eq(teInterestsTable.teId, teProspectiveCacheTable.teId)
      )
      .innerJoin(usersTable, eq(teInterestsTable.founderId, usersTable.id))
      .orderBy(teInterestsTable.expressedAt);

    res.json(interests);
  }
);

// POST /admin/te-sync — pull "1st Screen" pipeline candidates from Top Echelon
// via the te-recruit-mcp Worker bridge (GET /sync/prospective) and refresh the
// prospective cache. Manual entries and entries with expressed interest are
// never pruned.
router.post(
  "/admin/te-sync",
  requireAuth,
  async (req, res): Promise<void> => {
    if (req.session.userRole !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const syncUrl = process.env.TE_SYNC_URL;
    const syncSecret = process.env.TE_SYNC_SECRET;
    if (!syncUrl || !syncSecret) {
      res.status(503).json({
        success: false,
        error: "TE sync is not configured (TE_SYNC_URL / TE_SYNC_SECRET missing)",
      });
      return;
    }

    try {
      const bridgeRes = await fetch(`${syncUrl.replace(/\/+$/, "")}/sync/prospective`, {
        headers: { Authorization: `Bearer ${syncSecret}` },
        signal: AbortSignal.timeout(60_000),
      });
      if (!bridgeRes.ok) {
        const body = await bridgeRes.text();
        res.status(502).json({
          success: false,
          error: `TE bridge returned HTTP ${bridgeRes.status}: ${body.slice(0, 300)}`,
        });
        return;
      }

      const payload = (await bridgeRes.json()) as {
        stage: string;
        candidates: BridgeCandidate[];
      };
      const rows = (payload.candidates ?? []).map(mapBridgeCandidate);

      const now = new Date();
      for (const row of rows) {
        await db
          .insert(teProspectiveCacheTable)
          .values({ ...row, lastSyncedAt: now })
          .onConflictDoUpdate({
            target: teProspectiveCacheTable.teId,
            set: { ...row, lastSyncedAt: now },
          });
      }

      // Prune TE-sourced rows that left the screening stage, unless a founder
      // has expressed interest (that signal should stay visible to admins).
      const keepIds = rows.map((r) => r.teId);
      const pruned = await db
        .delete(teProspectiveCacheTable)
        .where(
          and(
            sql`${teProspectiveCacheTable.teId} NOT LIKE 'MANUAL-%'`,
            keepIds.length
              ? notInArray(teProspectiveCacheTable.teId, keepIds)
              : undefined,
            notInArray(
              teProspectiveCacheTable.teId,
              db.select({ teId: teInterestsTable.teId }).from(teInterestsTable)
            )
          )
        )
        .returning({ teId: teProspectiveCacheTable.teId });

      res.json({
        success: true,
        synced: rows.length,
        pruned: pruned.length,
        stage: payload.stage,
      });
    } catch (err: unknown) {
      const e = err as Error;
      res.status(502).json({ success: false, error: e.message });
    }
  }
);

export default router;
