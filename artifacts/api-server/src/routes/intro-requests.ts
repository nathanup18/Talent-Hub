import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  introRequestsTable,
  candidatesTable,
  usersTable,
} from "@workspace/db";
import { fetchTeContact } from "../lib/te-contact";
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

function formatRequest(r: {
  id: number;
  candidateId: number;
  candidateHeadline: string;
  candidateRoleCategory: string;
  founderId: number;
  founderName: string;
  founderCompany: string | null;
  status: string;
  requestType: string;
  requestedAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    candidateId: r.candidateId,
    candidateHeadline: r.candidateHeadline,
    candidateRoleCategory: r.candidateRoleCategory,
    founderId: r.founderId,
    founderName: r.founderName,
    founderCompany: r.founderCompany,
    status: r.status,
    requestType: r.requestType,
    requestedAt: r.requestedAt,
    updatedAt: r.updatedAt,
  };
}

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
    const { candidateId, requestType = "intro" } = parsed.data;
    const founderId = req.session.userId!;
    // The founder's free-text note (from the More Info dialog) isn't part of the
    // generated body schema, so read it off the raw body and cap its length.
    const note =
      typeof (req.body as { note?: unknown })?.note === "string"
        ? ((req.body as { note: string }).note).slice(0, 500)
        : "";

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

    // Check for duplicate request of the same type
    const [existing] = await db
      .select()
      .from(introRequestsTable)
      .where(
        and(
          eq(introRequestsTable.founderId, founderId),
          eq(introRequestsTable.candidateId, candidateId),
          eq(introRequestsTable.requestType, requestType)
        )
      );

    if (existing) {
      const label = requestType === "more_info" ? "more info" : "an intro";
      res.status(409).json({ error: `You have already requested ${label} for this candidate` });
      return;
    }

    const [introRequest] = await db
      .insert(introRequestsTable)
      .values({ founderId, candidateId, requestType })
      .returning();

    const [founder] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, founderId));

    res.status(201).json(
      CreateIntroRequestResponse.parse(formatRequest({
        id: introRequest.id,
        candidateId: introRequest.candidateId,
        candidateHeadline: candidate.anonymizedHeadline,
        candidateRoleCategory: candidate.roleCategory,
        founderId: introRequest.founderId,
        founderName: founder.name,
        founderCompany: founder.company ?? null,
        status: introRequest.status,
        requestType: introRequest.requestType,
        requestedAt: introRequest.requestedAt,
        updatedAt: introRequest.updatedAt,
      }))
    );

    // Fetch the candidate's contact live from Top Echelon (via candidate.teId)
    // for BOTH intro and more-info requests, so the team's Zap always knows who
    // the real person is. Nothing is stored. Goes only to the internal webhook.
    let contact:
      | { fullName: string | null; email: string | null; phone: string | null; linkedin: string | null }
      | null = null;
    if (candidate.teId) {
      try {
        const c = await fetchTeContact(candidate.teId);
        contact = { fullName: c.fullName, email: c.email, phone: c.phone, linkedin: c.linkedin };
      } catch (err) {
        // Degrade gracefully: the request still logs; the Zap just won't have
        // contact, so introReady stays false and an admin can follow up.
        console.error("[te-contact] lookup failed:", err);
      }
    }
    // Auto-intro is ready only for an actual Intro request with an email — so
    // the Zap's auto-send path never fires on a More Info request.
    const introReady = requestType === "intro" && !!contact?.email;

    // Fire Zapier webhook — non-blocking, never delays the response
    const zapierUrl = process.env.ZAPIER_INTRO_REQUEST_WEBHOOK_URL;
    if (zapierUrl) {
      fetch(zapierUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: requestType === "more_info" ? "More Info" : "Intro",
          // Stable identifiers so the Zap knows exactly which records this touches.
          introRequestId: introRequest.id,
          candidateId: candidate.id,
          candidateInternalId: candidate.internalId,
          candidateTeId: candidate.teId ?? null,
          pool: candidate.pool,
          founderId: founder.id,
          founderName: founder.name,
          founderEmail: founder.email,
          founderCompany: founder.company ?? "",
          candidateHeadline: candidate.anonymizedHeadline,
          candidateRoleCategory: candidate.roleCategory,
          requestedAt: introRequest.requestedAt,
          // Founder's free-text note (populated on More Info requests).
          note,
          // Auto-intro fields: present only for real intro requests. When
          // introReady is true the Zap has both sides' emails and can send the
          // introduction without any manual admin lookup.
          introReady,
          candidateName: contact?.fullName ?? null,
          candidateEmail: contact?.email ?? null,
          candidatePhone: contact?.phone ?? null,
          candidateLinkedin: contact?.linkedin ?? null,
        }),
      }).catch((err) => {
        console.error("[zapier] webhook failed:", err);
      });
    }
  }
);

// DELETE /intro-requests/:id  — founder cancels their own request
router.delete(
  "/intro-requests/:id",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const founderId = req.session.userId!;
    const isAdmin = req.session.userRole === "admin";

    // Founders can only cancel their own; admins can cancel any
    const [request] = await db
      .select()
      .from(introRequestsTable)
      .where(eq(introRequestsTable.id, id));

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    if (!isAdmin && request.founderId !== founderId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Hard-delete founder cancellation so the record is gone.
    // "closed" status is reserved for admin-declined requests only.
    await db
      .delete(introRequestsTable)
      .where(eq(introRequestsTable.id, id));

    res.json({ success: true });
  }
);

// PATCH /intro-requests/:id  — admin status update
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
      UpdateIntroRequestResponse.parse(formatRequest({
        id: updated.id,
        candidateId: updated.candidateId,
        candidateHeadline: candidate?.anonymizedHeadline ?? "",
        candidateRoleCategory: candidate?.roleCategory ?? "Engineering",
        founderId: updated.founderId,
        founderName: founder?.name ?? "",
        founderCompany: founder?.company ?? null,
        status: updated.status,
        requestType: updated.requestType,
        requestedAt: updated.requestedAt,
        updatedAt: updated.updatedAt,
      }))
    );
  }
);

export default router;
