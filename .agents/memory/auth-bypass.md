---
name: Auth domain bypass rules
description: How @activeimpactinvestments.com signup/login is handled vs regular users
---

## @activeimpactinvestments.com signup rules

At signup time, `@activeimpactinvestments.com` emails:
- **Bypass** the portfolio company domain whitelist check
- Are **auto-verified** (`emailVerified = true`) — no email token needed
- Get `role = "admin"` **only if** the email is exactly `nathan@activeimpactinvestments.com`
- All other `@activeimpactinvestments.com` accounts get `role = "founder"`

## Login / /auth/me

No domain-based role overrides at login or session refresh. Role is read directly from the DB.

**Why:** The user explicitly said only Nathan should be admin, not the whole domain.

## Nathan's account

- Email: `nathan@activeimpactinvestments.com`
- DB role: `admin` (set at creation time; persists in DB)
