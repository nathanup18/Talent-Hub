import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  introRequestsTable,
  candidatesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, requireVerified } from "../middlewares/auth";
import {
  CreateIntroRequestBody,
  UpdateIntroRequestBody,
  UpdateIntroRequestParams,
  ListIntroRequestsResponse,
  CreateIntroRequestResponse,
  UpdateIntroRequestResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /intro-requests
router.get(
  "/intro-requests",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const isAdmin = req.session.userRole === "admin";
    const userId = req.session.userId!;

    const requests = await db
      .select({
        id: introRequestsTable.id,
        candidateId: introRequestsTable.candidateId,
        candidateHeadline: candidatesTable.anonymizedHeadline,
        candidateRoleCategory: candidatesTable.roleCategory,
        founderId: introRequestsTable.founderId,
        founderName: usersTable.name,
        founderCompany: usersTable.company,
        status: introRequestsTable.status,
        requestedAt: introRequestsTable.requestedAt,
        updatedAt: introRequestsTable.updatedAt,
      })
      .from(introRequestsTable)
      .innerJoin(
        candidatesTable,
        eq(introRequestsTable.candidateId, candidatesTable.id)
      )
      .innerJoin(usersTable, eq(introRequestsTable.founderId, usersTable.id))
      .where(
        isAdmin
          ? undefined
          : eq(introRequestsTable.founderId, userId)
      );

    res.json(ListIntroRequestsResponse.parse(requests));
  }
);

// POST /intro-requests
router.post(
  "/intro-requests",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const parsed = CreateIntroRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { candidateId } = parsed.data;
    const founderId = req.session.userId!;

    // Check candidate exists and is opted in
    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(
        and(
          eq(candidatesTable.id, candidateId),
          eq(candidatesTable.status, "opted_in")
        )
      );

    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    // Check for duplicate request
    const [existing] = await db
      .select()
      .from(introRequestsTable)
      .where(
        and(
          eq(introRequestsTable.founderId, founderId),
          eq(introRequestsTable.candidateId, candidateId)
        )
      );

    if (existing) {
      res.status(409).json({ error: "You have already requested an intro to this candidate" });
      return;
    }

    const [introRequest] = await db
      .insert(introRequestsTable)
      .values({ founderId, candidateId })
      .returning();

    const [founder] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, founderId));

    res.status(201).json(
      CreateIntroRequestResponse.parse({
        id: introRequest.id,
        candidateId: introRequest.candidateId,
        candidateHeadline: candidate.anonymizedHeadline,
        candidateRoleCategory: candidate.roleCategory,
        founderId: introRequest.founderId,
        founderName: founder.name,
        founderCompany: founder.company,
        status: introRequest.status,
        requestedAt: introRequest.requestedAt,
        updatedAt: introRequest.updatedAt,
      })
    );
  }
);

// PATCH /intro-requests/:id
router.patch(
  "/intro-requests/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const paramsParsed = UpdateIntroRequestParams.safeParse(req.params);
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { id } = paramsParsed.data;

    const parsed = UpdateIntroRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [updated] = await db
      .update(introRequestsTable)
      .set({ status: parsed.data.status })
      .where(eq(introRequestsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Intro request not found" });
      return;
    }

    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, updated.candidateId));

    const [founder] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, updated.founderId));

    res.json(
      UpdateIntroRequestResponse.parse({
        id: updated.id,
        candidateId: updated.candidateId,
        candidateHeadline: candidate?.anonymizedHeadline ?? "",
        candidateRoleCategory: candidate?.roleCategory ?? "Engineering",
        founderId: updated.founderId,
        founderName: founder?.name ?? "",
        founderCompany: founder?.company ?? null,
        status: updated.status,
        requestedAt: updated.requestedAt,
        updatedAt: updated.updatedAt,
      })
    );
  }
);

export default router;
