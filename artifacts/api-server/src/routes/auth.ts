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

const router: IRouter = Router();

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

  // @activeimpactinvestments.com users are auto-approved as admin (no whitelist check needed)
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

  // Active Impact team members get immediate admin access, no email verification required
  const role = isActiveImpactDomain ? "admin" : "founder";
  const emailVerified = isActiveImpactDomain ? true : false;

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      company: isActiveImpactDomain ? (company ?? "Active Impact Investments") : company,
      role,
      emailVerified,
    })
    .returning();

  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.emailVerified = user.emailVerified;

  if (isActiveImpactDomain) {
    // Active Impact team: immediate access, no verification needed
    req.log.info({ userId: user.id }, "Active Impact team member registered as admin");
    res.status(201).json({
      user: formatUser(user),
      message: "Welcome to Active Impact Talent Hub. Your admin account is ready.",
    });
    return;
  }

  // Create verification token for non-AII users
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db.insert(emailVerificationTokensTable).values({
    userId: user.id,
    token,
    expiresAt,
  });

  req.log.info({ userId: user.id }, "User signed up, verification token created");

  res.status(201).json({
    user: formatUser(user),
    message: `Please check your email to verify your account. Verification token: ${token}`,
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

  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.emailVerified = user.emailVerified;

  res.json({ user: formatUser(user) });
});

// POST /auth/logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
    }
  });
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

  // Refresh session
  req.session.emailVerified = user.emailVerified;
  req.session.userRole = user.role;

  res.json({ user: formatUser(user) });
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

export default router;
