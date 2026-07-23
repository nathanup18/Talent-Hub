import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, teProspectiveCacheTable, teInterestsTable, usersTable } from "@workspace/db";
import { requireAuth, requireVerified } from "../middlewares/auth";
import { z } from "zod";

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
    // For TE-sourced entries, keep the most recently synced one per category.
    // Manual entries (MANUAL- prefix) are always kept individually.
    const seen = new Map<string, typeof allCandidates[0]>();
    for (const c of allCandidates) {
      if (c.teId.startsWith("MANUAL-")) continue; // handled separately
      const existing = seen.get(c.roleCategory);
      if (!existing || c.lastSyncedAt > existing.lastSyncedAt) {
        seen.set(c.roleCategory, c);
      }
    }
    const manuals = allCandidates.filter((c) => c.teId.startsWith("MANUAL-"));
    const candidates = [...seen.values(), ...manuals];

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

// POST /admin/te-sync — trigger a TE sync (runs the sync script)
router.post(
  "/admin/te-sync",
  requireAuth,
  async (req, res): Promise<void> => {
    if (req.session.userRole !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(
        "pnpm --filter @workspace/api-server run sync:te",
        { timeout: 120_000, cwd: process.cwd() }
      );
      res.json({
        success: true,
        output: stdout.slice(-2000),
        errors: stderr.slice(-500) || undefined,
      });
    } catch (err: unknown) {
      const e = err as { message?: string; stdout?: string; stderr?: string };
      res.status(500).json({
        success: false,
        error: e.message,
        output: e.stdout?.slice(-1000),
      });
    }
  }
);

export default router;
