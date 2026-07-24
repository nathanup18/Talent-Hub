import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  domainsTable,
  emailVerificationTokensTable,
} from "@workspace/db";
import {
  SignupBody,
  LoginBody,
  VerifyEmailBody,
  ResendVerificationBody,
} from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

// Admins are recognized at signup and self-healed on login and /auth/me, so
// admin access never depends on when the account was created.
// - Anyone on the Active Impact domain is an admin.
// - ADMIN_EMAILS covers any additional admins outside that domain.
const ADMIN_DOMAIN = "activeimpactinvestments.com";
const ADMIN_EMAILS = new Set<string>([]);

function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.split("@")[1] === ADMIN_DOMAIN || ADMIN_EMAILS.has(lower);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

function formatUser(user: {
  id: number;
  email: string;
  name: string;
  company: string | null;
  role: "founder" | "admin";
  emailVerified: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    company: user.company,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

// POST /auth/signup
router.post("/auth/signup", authLimiter, async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, name, company } = parsed.data;

  // Validate email domain against whitelist
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  // @activeimpactinvestments.com users bypass the portfolio whitelist and are auto-verified,
  // but only nathan@ gets admin role — all others sign up as founders.
  const isActiveImpactDomain = domain === "activeimpactinvestments.com";

  if (!isActiveImpactDomain) {
    const [whitelistedDomain] = await db
      .select()
      .from(domainsTable)
      .where(eq(domainsTable.domain, domain));

    if (!whitelistedDomain) {
      res.status(400).json({
        error:
          "Your email domain is not on the portfolio company whitelist. Please contact the Active Impact team to get access.",
      });
      return;
    }
  }

  // Check for existing user
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));
  if (existingUser) {
    res.status(400).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Active Impact staff (by email/domain) are admins; everyone else is a founder.
  const role = isAdminEmail(email) ? "admin" : "founder";

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      company: isActiveImpactDomain ? (company ?? "Active Impact Investments") : company,
      role,
      emailVerified: true,
    })
    .returning();

  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.emailVerified = true;

  req.log.info({ userId: user.id, role }, "User registered");

  res.status(201).json({
    user: formatUser(user),
    message: "Welcome to Active Impact Talent Hub.",
  });
});

// POST /auth/login
router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Self-heal the admin role for pre-provisioned admins, even if the account
  // was created before the rule existed. Promote on login so admin access
  // never depends on signup timing.
  let effectiveUser = user;
  if (isAdminEmail(user.email) && user.role !== "admin") {
    const [promoted] = await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, user.id))
      .returning();
    if (promoted) effectiveUser = promoted;
    req.log.info({ userId: user.id }, "Promoted pre-provisioned admin on login");
  }

  req.session.userId = effectiveUser.id;
  req.session.userRole = effectiveUser.role;
  req.session.emailVerified = effectiveUser.emailVerified;

  res.json({ user: formatUser(effectiveUser) });
});

// POST /auth/logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve) => {
    req.session.destroy((err) => {
      if (err) req.log.error({ err }, "Failed to destroy session");
      resolve();
    });
  });
  res.clearCookie("connect.sid");
  res.json({ success: true });
});

// GET /auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Self-heal the admin role for pre-provisioned admins without re-logging in.
  let effectiveUser = user;
  if (isAdminEmail(user.email) && user.role !== "admin") {
    const [promoted] = await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, user.id))
      .returning();
    if (promoted) effectiveUser = promoted;
  }

  // Refresh session
  req.session.emailVerified = effectiveUser.emailVerified;
  req.session.userRole = effectiveUser.role;

  res.json({ user: formatUser(effectiveUser) });
});

// POST /auth/verify-email
router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }
  const { token } = parsed.data;

  const [tokenRecord] = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(eq(emailVerificationTokensTable.token, token));

  if (!tokenRecord) {
    res.status(400).json({ error: "Invalid or expired verification token" });
    return;
  }

  if (tokenRecord.expiresAt < new Date()) {
    res.status(400).json({ error: "Verification token has expired" });
    return;
  }

  // Mark user as verified
  const [user] = await db
    .update(usersTable)
    .set({ emailVerified: true })
    .where(eq(usersTable.id, tokenRecord.userId))
    .returning();

  // Delete the token
  await db
    .delete(emailVerificationTokensTable)
    .where(eq(emailVerificationTokensTable.id, tokenRecord.id));

  if (req.session.userId === user.id) {
    req.session.emailVerified = true;
  }

  res.json({ user: formatUser(user) });
});

// POST /auth/resend-verification
router.post(
  "/auth/resend-verification",
  authLimiter,
  async (req, res): Promise<void> => {
    const parsed = ResendVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    const { email } = parsed.data;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user || user.emailVerified) {
      // Don't reveal if user exists
      res.json({ success: true });
      return;
    }

    // Delete old tokens
    await db
      .delete(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.userId, user.id));

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(emailVerificationTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    req.log.info({ userId: user.id, token }, "Resent verification token");
    res.json({ success: true });
  }
);

// PATCH /auth/profile — update name/company for logged-in user
const UpdateProfileBody = z.object({
  name: z.string().min(1).max(200).optional(),
  company: z.string().max(200).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

router.patch("/auth/profile", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const schema = UpdateProfileBody;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { name, company, currentPassword, newPassword } = parsed.data;
  const userId = req.session.userId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (company !== undefined) updates.company = company;

  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: "Current password required to set a new password" });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updates).length === 0) {
    res.json({ user: formatUser(user) });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();

  res.json({ user: formatUser(updated) });
});

export default router;
