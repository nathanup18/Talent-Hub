import { Router, type IRouter } from "express";
import { eq, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, candidatesTable, usersTable } from "@workspace/db";
import { requireAuth, requireVerified } from "../middlewares/auth";
import {
  ListCandidatesQueryParams,
  GetCandidateParams,
  ListCandidatesResponse,
  GetCandidateResponse,
  GetCandidateBreakdownResponse,
} from "@workspace/api-zod";
import { introRequestsTable } from "@workspace/db";

const router: IRouter = Router();

// GET /candidates/breakdown — must be before /:id
router.get(
  "/candidates/breakdown",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const byRoleCategory = await db
      .select({
        category: candidatesTable.roleCategory,
        count: sql<number>`count(*)::int`,
      })
      .from(candidatesTable)
      .where(and(eq(candidatesTable.status, "opted_in"), eq(candidatesTable.pool, "talent_pool")))
      .groupBy(candidatesTable.roleCategory);

    const bySeniority = await db
      .select({
        seniority: candidatesTable.seniority,
        count: sql<number>`count(*)::int`,
      })
      .from(candidatesTable)
      .where(and(eq(candidatesTable.status, "opted_in"), eq(candidatesTable.pool, "talent_pool")))
      .groupBy(candidatesTable.seniority);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(candidatesTable)
      .where(and(eq(candidatesTable.status, "opted_in"), eq(candidatesTable.pool, "talent_pool")));

    res.json(
      GetCandidateBreakdownResponse.parse({
        byRoleCategory: byRoleCategory.map((r) => ({
          category: r.category,
          count: r.count,
        })),
        bySeniority: bySeniority.map((r) => ({
          seniority: r.seniority,
          count: r.count,
        })),
        total: totalResult?.count ?? 0,
      })
    );
  }
);

// GET /candidates
router.get(
  "/candidates",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const queryParsed = ListCandidatesQueryParams.safeParse(req.query);
    if (!queryParsed.success) {
      res.status(400).json({ error: queryParsed.error.message });
      return;
    }
    const q = queryParsed.data;
    const isAdmin = req.session.userRole === "admin";

    const conditions = [
      eq(candidatesTable.status, "opted_in"),
      eq(candidatesTable.pool, "talent_pool"),
    ];

    if (q.roleCategory) {
      conditions.push(
        eq(
          candidatesTable.roleCategory,
          q.roleCategory as
            | "Engineering"
            | "Sales"
            | "Operations"
            | "Product"
            | "Finance"
            | "Marketing"
            | "Executive"
        )
      );
    }
    if (q.seniority) {
      conditions.push(
        eq(
          candidatesTable.seniority,
          q.seniority as "IC" | "Manager" | "Director" | "VP" | "C-level"
        )
      );
    }
    if (q.location) {
      conditions.push(ilike(candidatesTable.location, `%${q.location}%`));
    }
    if (q.openToRelocation !== undefined) {
      conditions.push(
        eq(candidatesTable.openToRelocation, q.openToRelocation)
      );
    }
    if (q.yearsExpMin !== undefined) {
      conditions.push(gte(candidatesTable.yearsExperience, q.yearsExpMin));
    }
    if (q.yearsExpMax !== undefined) {
      conditions.push(lte(candidatesTable.yearsExperience, q.yearsExpMax));
    }
    if (q.compMin !== undefined) {
      conditions.push(gte(candidatesTable.compRangeMax, q.compMin));
    }
    if (q.compMax !== undefined) {
      conditions.push(lte(candidatesTable.compRangeMin, q.compMax));
    }

    // Explicit column list: never selects realName/internalId/teId, and stays
    // resilient to schema changes (a new column can't blank the founder pool).
    let candidates = await db
      .select({
        id: candidatesTable.id,
        anonymizedHeadline: candidatesTable.anonymizedHeadline,
        roleCategory: candidatesTable.roleCategory,
        seniority: candidatesTable.seniority,
        yearsExperience: candidatesTable.yearsExperience,
        location: candidatesTable.location,
        openToRelocation: candidatesTable.openToRelocation,
        compRangeMin: candidatesTable.compRangeMin,
        compRangeMax: candidatesTable.compRangeMax,
        topSkills: candidatesTable.topSkills,
        summaryBlurb: candidatesTable.summaryBlurb,
        notableCredentials: candidatesTable.notableCredentials,
        status: candidatesTable.status,
        dateAdded: candidatesTable.dateAdded,
      })
      .from(candidatesTable)
      .where(and(...conditions));

    // Keyword search across headline, skills, summary blurb
    if (q.search) {
      const searchLower = q.search.toLowerCase();
      candidates = candidates.filter(
        (c) =>
          c.anonymizedHeadline.toLowerCase().includes(searchLower) ||
          c.summaryBlurb.toLowerCase().includes(searchLower) ||
          c.topSkills.some((s: string) => s.toLowerCase().includes(searchLower))
      );
    }

    // For founders, get which candidates they've requested
    let requestedCandidateIds = new Set<number>();
    if (!isAdmin && req.session.userId) {
      const myRequests = await db
        .select({ candidateId: introRequestsTable.candidateId })
        .from(introRequestsTable)
        .where(eq(introRequestsTable.founderId, req.session.userId));
      requestedCandidateIds = new Set(myRequests.map((r) => r.candidateId));
    }

    const result = candidates.map((c) => {
      // Never include realName or internalId for non-admins (enforced at query level)
      return {
        id: c.id,
        anonymizedHeadline: c.anonymizedHeadline,
        roleCategory: c.roleCategory,
        seniority: c.seniority,
        yearsExperience: c.yearsExperience,
        location: c.location,
        openToRelocation: c.openToRelocation,
        compRangeMin: c.compRangeMin,
        compRangeMax: c.compRangeMax,
        topSkills: c.topSkills,
        summaryBlurb: c.summaryBlurb,
        notableCredentials: c.notableCredentials,
        status: c.status,
        dateAdded: c.dateAdded,
        hasRequestedIntro: requestedCandidateIds.has(c.id),
      };
    });

    res.json(ListCandidatesResponse.parse(result));
  }
);

// GET /candidates/:id
router.get(
  "/candidates/:id",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    // Explicit column list: never selects realName/internalId/teId, and stays
    // resilient to schema changes.
    const [candidate] = await db
      .select({
        id: candidatesTable.id,
        anonymizedHeadline: candidatesTable.anonymizedHeadline,
        roleCategory: candidatesTable.roleCategory,
        seniority: candidatesTable.seniority,
        yearsExperience: candidatesTable.yearsExperience,
        location: candidatesTable.location,
        openToRelocation: candidatesTable.openToRelocation,
        compRangeMin: candidatesTable.compRangeMin,
        compRangeMax: candidatesTable.compRangeMax,
        topSkills: candidatesTable.topSkills,
        summaryBlurb: candidatesTable.summaryBlurb,
        notableCredentials: candidatesTable.notableCredentials,
        status: candidatesTable.status,
        dateAdded: candidatesTable.dateAdded,
      })
      .from(candidatesTable)
      .where(
        and(eq(candidatesTable.id, id), eq(candidatesTable.status, "opted_in"))
      );

    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    let hasRequestedIntro = false;
    if (req.session.userId) {
      const [req_] = await db
        .select()
        .from(introRequestsTable)
        .where(
          and(
            eq(introRequestsTable.founderId, req.session.userId),
            eq(introRequestsTable.candidateId, id)
          )
        );
      hasRequestedIntro = !!req_;
    }

    const result = {
      id: candidate.id,
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
      hasRequestedIntro,
    };

    res.json(GetCandidateResponse.parse(result));
  }
);

// GET /candidates/:id/blind-resume — anonymized resume profile for the listing.
// Served separately so it doesn't need to go through the generated candidate
// response schema. Founders only.
router.get(
  "/candidates/:id/blind-resume",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [candidate] = await db
      .select({
        blindResume: candidatesTable.blindResume,
        notableCredentials: candidatesTable.notableCredentials,
        pool: candidatesTable.pool,
      })
      .from(candidatesTable)
      .where(and(eq(candidatesTable.id, id), eq(candidatesTable.status, "opted_in")));
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }
    res.json({
      blindResume: candidate.blindResume ?? null,
      notableCredentials: candidate.notableCredentials ?? null,
      pool: candidate.pool,
    });
  }
);

// ── Prospective pool (earlier-funnel candidates, browse by function) ─────────

// GET /prospective/functions — role categories with counts, for the tiles.
router.get(
  "/prospective/functions",
  requireAuth,
  requireVerified,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        roleCategory: candidatesTable.roleCategory,
        count: sql<number>`count(*)::int`,
      })
      .from(candidatesTable)
      .where(and(eq(candidatesTable.status, "opted_in"), eq(candidatesTable.pool, "prospective")))
      .groupBy(candidatesTable.roleCategory)
      .orderBy(sql`count(*) desc`);
    res.json(rows);
  }
);

// GET /prospective/candidates?function=X — anonymized list within a function.
router.get(
  "/prospective/candidates",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const fn = Array.isArray(req.query.function) ? req.query.function[0] : req.query.function;
    const conditions = [
      eq(candidatesTable.status, "opted_in"),
      eq(candidatesTable.pool, "prospective"),
    ];
    if (fn && typeof fn === "string") {
      conditions.push(
        eq(
          candidatesTable.roleCategory,
          fn as "Engineering" | "Sales" | "Operations" | "Product" | "Finance" | "Marketing" | "Executive"
        )
      );
    }
    const rows = await db
      .select({
        id: candidatesTable.id,
        anonymizedHeadline: candidatesTable.anonymizedHeadline,
        roleCategory: candidatesTable.roleCategory,
        seniority: candidatesTable.seniority,
        yearsExperience: candidatesTable.yearsExperience,
        location: candidatesTable.location,
        topSkills: candidatesTable.topSkills,
        notableCredentials: candidatesTable.notableCredentials,
      })
      .from(candidatesTable)
      .where(and(...conditions))
      .orderBy(candidatesTable.anonymizedHeadline);
    res.json(rows);
  }
);

// POST /prospective/:id/express-interest — founder expresses interest in a
// prospective candidate. Recorded as an intro request of a distinct type so it
// shows in the admin pipeline; no contact is fetched (earlier funnel).
router.post(
  "/prospective/:id/express-interest",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const founderId = req.session.userId!;
    const { note } = z.object({ note: z.string().max(500).optional() }).parse(req.body ?? {});

    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(
        and(
          eq(candidatesTable.id, id),
          eq(candidatesTable.pool, "prospective"),
          eq(candidatesTable.status, "opted_in")
        )
      );
    if (!candidate) {
      res.status(404).json({ error: "Prospective candidate not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(introRequestsTable)
      .where(
        and(
          eq(introRequestsTable.founderId, founderId),
          eq(introRequestsTable.candidateId, id),
          eq(introRequestsTable.requestType, "prospective_interest")
        )
      );
    if (existing) {
      res.status(409).json({ error: "You have already expressed interest in this candidate" });
      return;
    }

    await db
      .insert(introRequestsTable)
      .values({ founderId, candidateId: id, requestType: "prospective_interest" });

    res.status(201).json({ success: true, expressedInterest: true });

    // Fire Zapier — non-blocking.
    const zapierUrl = process.env.ZAPIER_INTRO_REQUEST_WEBHOOK_URL;
    if (zapierUrl) {
      const [founder] = await db.select().from(usersTable).where(eq(usersTable.id, founderId));
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
      }).catch((err) => console.error("[zapier] prospective interest webhook failed:", err));
    }
  }
);

export default router;
