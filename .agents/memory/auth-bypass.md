---
name: Active Impact domain auto-admin bypass
description: Special signup behavior for @activeimpactinvestments.com email domain.
---

## Rule
Anyone signing up with `@activeimpactinvestments.com` email:
- Gets `role: "admin"` automatically (no whitelist check needed)
- Gets `emailVerified: true` immediately
- Does NOT receive a verification token or email
- Session is created immediately after signup
- Response says "Welcome to Active Impact Talent Hub. Your admin account is ready."

**Why:** Internal team should have frictionless access; they don't need email verification.

**How to apply:** In `artifacts/api-server/src/routes/auth.ts`, check `isActiveImpactDomain` before inserting user, skip token creation for that domain, return early with admin welcome message.
