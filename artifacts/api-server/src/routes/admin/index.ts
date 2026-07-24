import { Router, type IRouter } from "express";
import { eq, sql, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  candidatesTable,
  domainsTable,
  introRequestsTable,
  teProspectiveCacheTable,
  usersTable,
} from "@workspace/db";
import { fetchTeContact, TeContactError } from "../../lib/te-contact";
import { mapBridgeCandidate, type BridgeCandidate } from "../../lib/te-sync";
import { requireAdmin } from "../../middlewares/auth";
import {
  CreateCandidateBody,
  UpdateCandidateBody,
  UpdateCandidateParams,
  DeleteCandidateParams,
  AddDomainBody,
  DeleteDomainParams,
  ListAdminIntroRequestsResponse,
  GetAdminStatsResponse,
  CreateCandidateResponse,
  UpdateCandidateResponse,
  ListDomainsResponse,
  AddDomainResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /admin/stats
router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const [totalCandidatesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(candidatesTable);

  // candidates offered = appeared in at least one intro request
  const [offeredResult] = await db
    .select({
      count: sql<number>`count(distinct ${introRequestsTable.candidateId})::int`,
    })
    .from(introRequestsTable);

  const [introsMadeResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(introRequestsTable)
    .where(eq(introRequestsTable.status, "intro_made"));

  const [placementsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(candidatesTable)
    .where(eq(candidatesTable.status, "placed"));

  res.json(
    GetAdminStatsResponse.parse({
      totalCandidates: totalCandidatesResult?.count ?? 0,
      candidatesOffered: offeredResult?.count ?? 0,
      introsMade: introsMadeResult?.count ?? 0,
      placements: placementsResult?.count ?? 0,
    })
  );
});

// GET /admin/candidates — handled via /candidates route (admin sees real names)
// handled in admin/candidates below

// POST /admin/candidates
router.post(
  "/admin/candidates",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateCandidateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const data = parsed.data;
    const rawDate = data.dateAdded;
    const dateAdded: string =
      rawDate instanceof Date
        ? rawDate.toISOString().split("T")[0]
        : (rawDate ?? new Date().toISOString().split("T")[0]);

    const [candidate] = await db
      .insert(candidatesTable)
      .values({
        internalId: data.internalId,
        realName: data.realName,
        anonymizedHeadline: data.anonymizedHeadline,
        roleCategory: data.roleCategory,
        seniority: data.seniority,
        yearsExperience: data.yearsExperience,
        location: data.location,
        openToRelocation: data.openToRelocation,
        compRangeMin: data.compRangeMin,
        compRangeMax: data.compRangeMax,
        topSkills: data.topSkills,
        summaryBlurb: data.summaryBlurb,
        notableCredentials: data.notableCredentials,
        status: data.status,
        dateAdded,
      })
      .returning();

    res.status(201).json(
      CreateCandidateResponse.parse({
        id: candidate.id,
        internalId: candidate.internalId,
        realName: candidate.realName,
        anonymizedHeadline: candidate.anonymizedHeadline,
        roleCategory: candidate.roleCategory,
        seniority: candidate.seniority,
        yearsExperience: candidate.yearsExperience,
        location: candidate.location,
        openToRelocation: candidate.openToRelocation,
        compRangeMin: candidate.compRangeMin,
        compRangeMax: candidate.compRangeMax,
        topSkills: candidate.topSkills,
        summaryBlurb: candidate.summaryBlurb,
        notableCredentials: candidate.notableCredentials,
        status: candidate.status,
        dateAdded: candidate.dateAdded,
      })
    );
  }
);

// POST /admin/candidates/import-from-te — populate the Talent Pool from Top
// Echelon candidates at a pipeline stage (default "1st Screen"). Each imported
// candidate is linked (te_id) so contact is fetched live at intro time; comp is
// left at 0 (not shown to founders). Idempotent on te_id. With replaceSeed, the
// unlinked seed candidates are removed first (delete cascades to intro requests).
router.post("/admin/candidates/import-from-te", requireAdmin, async (req, res): Promise<void> => {
  const body = z
    .object({ stage: z.string().trim().min(1).optional(), replaceSeed: z.boolean().optional() })
    .safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const stage = body.data.stage ?? "1st Screen";

  const syncUrl = process.env.TE_SYNC_URL;
  const syncSecret = process.env.TE_SYNC_SECRET;
  if (!syncUrl || !syncSecret) {
    res.status(503).json({ error: "TE sync is not configured (TE_SYNC_URL / TE_SYNC_SECRET missing)" });
    return;
  }

  let bridge: { candidates: BridgeCandidate[] };
  try {
    const r = await fetch(
      `${syncUrl.replace(/\/+$/, "")}/sync/prospective?stage=${encodeURIComponent(stage)}`,
      { headers: { Authorization: `Bearer ${syncSecret}` }, signal: AbortSignal.timeout(60_000) }
    );
    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: `TE bridge returned HTTP ${r.status}: ${t.slice(0, 200)}` });
      return;
    }
    bridge = (await r.json()) as { candidates: BridgeCandidate[] };
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "TE bridge unreachable" });
    return;
  }

  let cleared = 0;
  if (body.data.replaceSeed) {
    const removed = await db
      .delete(candidatesTable)
      .where(isNull(candidatesTable.teId))
      .returning({ id: candidatesTable.id });
    cleared = removed.length;
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const bc of bridge.candidates ?? []) {
    try {
      const [existing] = await db
        .select({ id: candidatesTable.id })
        .from(candidatesTable)
        .where(eq(candidatesTable.teId, bc.te_id));
      if (existing) {
        skipped++;
        continue;
      }

      const mapped = mapBridgeCandidate(bc);
      let realName = "Top Echelon candidate";
      try {
        const contact = await fetchTeContact(bc.te_id);
        if (contact.fullName) realName = contact.fullName;
      } catch {
        // keep placeholder; admin can correct later
      }

      const years = Number(mapped.yearsExperienceEstimate);
      await db.insert(candidatesTable).values({
        internalId: `TE-${bc.te_id}`,
        realName,
        teId: bc.te_id,
        anonymizedHeadline: mapped.anonymizedHeadline,
        roleCategory: mapped.roleCategory as
          | "Engineering" | "Sales" | "Operations" | "Product" | "Finance" | "Marketing" | "Executive",
        seniority: mapped.seniority as "IC" | "Manager" | "Director" | "VP" | "C-level",
        yearsExperience: Number.isFinite(years) ? years : 0,
        location: mapped.location,
        openToRelocation: false,
        compRangeMin: 0,
        compRangeMax: 0,
        topSkills: mapped.topSkills,
        summaryBlurb: mapped.summaryBlurb,
        notableCredentials: mapped.educationLevel ?? "",
        status: "opted_in",
        dateAdded: today,
      });
      imported++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  res.json({ success: true, stage, imported, skipped, cleared, errors });
});

// PATCH /admin/candidates/:id
router.patch(
  "/admin/candidates/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const paramsParsed = UpdateCandidateParams.safeParse(req.params);
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { id } = paramsParsed.data;

    const parsed = UpdateCandidateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updateData: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.realName !== undefined) updateData.realName = d.realName;
    if (d.anonymizedHeadline !== undefined)
      updateData.anonymizedHeadline = d.anonymizedHeadline;
    if (d.roleCategory !== undefined) updateData.roleCategory = d.roleCategory;
    if (d.seniority !== undefined) updateData.seniority = d.seniority;
    if (d.yearsExperience !== undefined)
      updateData.yearsExperience = d.yearsExperience;
    if (d.location !== undefined) updateData.location = d.location;
    if (d.openToRelocation !== undefined)
      updateData.openToRelocation = d.openToRelocation;
    if (d.compRangeMin !== undefined) updateData.compRangeMin = d.compRangeMin;
    if (d.compRangeMax !== undefined) updateData.compRangeMax = d.compRangeMax;
    if (d.topSkills !== undefined) updateData.topSkills = d.topSkills;
    if (d.summaryBlurb !== undefined) updateData.summaryBlurb = d.summaryBlurb;
    if (d.notableCredentials !== undefined)
      updateData.notableCredentials = d.notableCredentials;
    if (d.status !== undefined) updateData.status = d.status;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [candidate] = await db
      .update(candidatesTable)
      .set(updateData as any)
      .where(eq(candidatesTable.id, id))
      .returning();

    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    res.json(
      UpdateCandidateResponse.parse({
        id: candidate.id,
        internalId: candidate.internalId,
        realName: candidate.realName,
        anonymizedHeadline: candidate.anonymizedHeadline,
        roleCategory: candidate.roleCategory,
        seniority: candidate.seniority,
        yearsExperience: candidate.yearsExperience,
        location: candidate.location,
        openToRelocation: candidate.openToRelocation,
        compRangeMin: candidate.compRangeMin,
        compRangeMax: candidate.compRangeMax,
        topSkills: candidate.topSkills,
        summaryBlurb: candidate.summaryBlurb,
        notableCredentials: candidate.notableCredentials,
        status: candidate.status,
        dateAdded: candidate.dateAdded,
      })
    );
  }
);

// DELETE /admin/candidates/:id
router.delete(
  "/admin/candidates/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const paramsParsed = DeleteCandidateParams.safeParse(req.params);
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { id } = paramsParsed.data;

    const [deleted] = await db
      .delete(candidatesTable)
      .where(eq(candidatesTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    res.sendStatus(204);
  }
);

// ── Connected record (live from Top Echelon) ────────────────────────────────
// A vetted candidate can be linked to a Top Echelon person (candidates.te_id).
// The real identity/contact is never stored — it is fetched live from TE when
// an admin views it or a founder requests an intro. Admin-only routes.

async function loadCandidate(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, id));
  return candidate ?? null;
}

// PUT /admin/candidates/:id/te-link — set or clear the TE link (stores only the id)
router.put("/admin/candidates/:id/te-link", requireAdmin, async (req, res): Promise<void> => {
  const candidate = await loadCandidate(req.params.id);
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  const parsed = z.object({ teId: z.string().trim().max(100).nullish() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const teId = parsed.data.teId?.trim() || null;
  const [updated] = await db
    .update(candidatesTable)
    .set({ teId })
    .where(eq(candidatesTable.id, candidate.id))
    .returning({ id: candidatesTable.id, teId: candidatesTable.teId });
  res.json(updated);
});

// GET /admin/candidates/:id/contact — live TE contact for the linked person
router.get("/admin/candidates/:id/contact", requireAdmin, async (req, res): Promise<void> => {
  const candidate = await loadCandidate(req.params.id);
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  if (!candidate.teId) {
    res.json({ teId: null, linked: false, contact: null });
    return;
  }
  try {
    const contact = await fetchTeContact(candidate.teId);
    res.json({ teId: candidate.teId, linked: true, contact });
  } catch (err) {
    const status = err instanceof TeContactError ? err.status ?? 502 : 502;
    res.status(status).json({
      teId: candidate.teId,
      linked: true,
      contact: null,
      error: err instanceof Error ? err.message : "TE lookup failed",
    });
  }
});

// GET /admin/domains
router.get("/admin/domains", requireAdmin, async (req, res): Promise<void> => {
  const domains = await db.select().from(domainsTable).orderBy(domainsTable.domain);
  res.json(ListDomainsResponse.parse(domains));
});

// POST /admin/domains
router.post("/admin/domains", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AddDomainBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const domainValue = parsed.data.domain.toLowerCase().trim();

  const [existing] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.domain, domainValue));

  if (existing) {
    res.status(409).json({ error: "Domain already whitelisted" });
    return;
  }

  const [domain] = await db
    .insert(domainsTable)
    .values({ domain: domainValue, companyName: parsed.data.companyName })
    .returning();

  res.status(201).json(AddDomainResponse.parse(domain));
});

// DELETE /admin/domains/:id
router.delete(
  "/admin/domains/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const paramsParsed = DeleteDomainParams.safeParse(req.params);
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { id } = paramsParsed.data;

    const [deleted] = await db
      .delete(domainsTable)
      .where(eq(domainsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Domain not found" });
      return;
    }

    res.sendStatus(204);
  }
);

// POST /admin/prospective — manually add a prospective candidate
router.post("/admin/prospective", requireAdmin, async (req, res): Promise<void> => {
  const schema = {
    anonymizedHeadline: "string",
    roleCategory: "string",
    seniority: "string",
    location: "string",
    topSkills: "array",
    summaryBlurb: "string",
    educationLevel: "string|null",
    yearsExperienceEstimate: "string|null",
  };
  void schema;

  const body = req.body as {
    anonymizedHeadline: string;
    roleCategory: string;
    seniority: string;
    location: string;
    topSkills: string[];
    summaryBlurb: string;
    educationLevel?: string | null;
    yearsExperienceEstimate?: string | null;
  };

  if (!body.anonymizedHeadline || !body.roleCategory || !body.seniority || !body.location) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Generate a unique manual ID so it won't collide with TE IDs
  const teId = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const [entry] = await db
    .insert(teProspectiveCacheTable)
    .values({
      teId,
      anonymizedHeadline: body.anonymizedHeadline,
      roleCategory: body.roleCategory,
      seniority: body.seniority,
      location: body.location,
      topSkills: Array.isArray(body.topSkills) ? body.topSkills : [],
      summaryBlurb: body.summaryBlurb ?? "",
      educationLevel: body.educationLevel ?? null,
      yearsExperienceEstimate: body.yearsExperienceEstimate ?? null,
    })
    .returning();

  res.status(201).json(entry);
});

// DELETE /admin/prospective/:teId — remove a manually-added prospective entry
router.delete("/admin/prospective/:teId", requireAdmin, async (req, res): Promise<void> => {
  const { teId } = req.params;
  if (!teId) {
    res.status(400).json({ error: "Missing teId" });
    return;
  }

  const [deleted] = await db
    .delete(teProspectiveCacheTable)
    .where(eq(teProspectiveCacheTable.teId, teId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.sendStatus(204);
});

// POST /admin/prospective/bulk-sync — replaces all TE-sourced records with fresh data from MCP sync
router.post("/admin/prospective/bulk-sync", requireAdmin, async (req, res): Promise<void> => {
  const schema = z.array(z.object({
    teId: z.string(),
    anonymizedHeadline: z.string(),
    roleCategory: z.string(),
    seniority: z.string(),
    location: z.string(),
    topSkills: z.array(z.string()).default([]),
    summaryBlurb: z.string().default(""),
    educationLevel: z.string().nullable().optional(),
    yearsExperienceEstimate: z.string().nullable().optional(),
    compExpectation: z.string().nullable().optional(),
    screeningDate: z.string().nullable().optional(),
  }));

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Delete all non-manual TE records, then insert fresh ones
  await db
    .delete(teProspectiveCacheTable)
    .where(sql`${teProspectiveCacheTable.teId} NOT LIKE 'MANUAL-%'`);

  if (parsed.data.length > 0) {
    await db.insert(teProspectiveCacheTable).values(
      parsed.data.map((r) => ({
        teId: r.teId,
        anonymizedHeadline: r.anonymizedHeadline,
        roleCategory: r.roleCategory,
        seniority: r.seniority,
        location: r.location,
        topSkills: r.topSkills,
        summaryBlurb: r.summaryBlurb,
        educationLevel: r.educationLevel ?? null,
        yearsExperienceEstimate: r.yearsExperienceEstimate ?? null,
        compExpectation: r.compExpectation ?? null,
        screeningDate: r.screeningDate ? new Date(r.screeningDate) : null,
        lastSyncedAt: new Date(),
      }))
    );
  }

  res.json({ success: true, count: parsed.data.length });
});

// GET /admin/intro-requests
router.get(
  "/admin/intro-requests",
  requireAdmin,
  async (req, res): Promise<void> => {
    const requests = await db
      .select({
        id: introRequestsTable.id,
        candidateId: introRequestsTable.candidateId,
        candidateHeadline: candidatesTable.anonymizedHeadline,
        candidateRealName: candidatesTable.realName,
        candidateRoleCategory: candidatesTable.roleCategory,
        founderId: introRequestsTable.founderId,
        founderName: usersTable.name,
        founderEmail: usersTable.email,
        founderCompany: usersTable.company,
        status: introRequestsTable.status,
        requestType: introRequestsTable.requestType,
        requestedAt: introRequestsTable.requestedAt,
        updatedAt: introRequestsTable.updatedAt,
      })
      .from(introRequestsTable)
      .innerJoin(
        candidatesTable,
        eq(introRequestsTable.candidateId, candidatesTable.id)
      )
      .innerJoin(usersTable, eq(introRequestsTable.founderId, usersTable.id))
      .orderBy(introRequestsTable.requestedAt);

    res.json(ListAdminIntroRequestsResponse.parse(requests));
  }
);

export default router;
