# Active Impact Talent Hub — Project Handoff

> **For:** Claude (incoming agent)
> **From:** Replit Agent (outgoing)
> **Date:** July 23, 2026
> **Priority note:** This project is on-brand for **Active Impact Investments**. All UI, copy, and design decisions should reflect their brand identity — clean, professional, impact-driven. Do not introduce visual styles, colours, or tone that feel generic or off-brand without confirming with Nathan.

---

## 1. What This Is

A **private talent marketplace** for Active Impact Investments. Portfolio company founders browse anonymized, pre-vetted executive/senior candidates and request introductions. A "Prospective" tab surfaces candidates from the Active Impact recruiter's Top Echelon (TE) ATS pipeline — shown anonymously so founders can express interest before the candidate is formally added to the marketplace.

Admins (Active Impact staff) manage candidates, portfolio company access, and intro requests.

---

## 2. Tech Stack & Architecture

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React + Vite + TypeScript (`artifacts/talent-hub`) |
| Backend | Express 5 + TypeScript (`artifacts/api-server`) |
| Database | Replit-managed PostgreSQL via Drizzle ORM (`lib/db`) |
| Session store | `connect-pg-simple` (Postgres-backed express-session) |
| Auth | Local bcrypt + httpOnly cookies |
| Schema validation | Zod v4 (`lib/api-zod`) |
| Build | esbuild (api-server), Vite (talent-hub) |
| Styling | Tailwind CSS + shadcn/ui |

**URL routing:** The Replit proxy routes everything from `/`. The frontend is served at `/talent-hub/` and the API is at `/api/*`. `BASE_URL` in the frontend is set at build time via Vite's env injection.

**Important build quirk:** `connect-pg-simple` must be listed as `external` in `artifacts/api-server/build.mjs` — if bundled, esbuild's `__dirname` rewrite causes it to look for `table.sql` in the wrong place, breaking sessions. This is already fixed; do not remove it from the externals list.

---

## 3. Auth & User Roles

Two roles: `founder` and `admin`.

| Rule | Detail |
|---|---|
| `@activeimpactinvestments.com` emails | Auto-verified, bypass portfolio whitelist |
| `nathan@activeimpactinvestments.com` | Gets `admin` role on signup |
| All other `@activeimpactinvestments.com` | Get `founder` role |
| Portfolio company founders | Must have their email domain whitelisted by an admin first (`domains` table) |
| Email verification | Required for portfolio founders; skipped for `@activeimpactinvestments.com` |
| Seeded admin | `admin@activeimpact.ca` (password in Replit secrets or Nathan's records) |

Rate limiting is on auth endpoints (20 req / 15 min). Sessions are stored in Postgres (`session` table, auto-created by `connect-pg-simple` on first request).

---

## 4. Database Schema

All schemas live in `lib/db/src/schema/`. Drizzle ORM with `drizzle-kit` for migrations (`drizzle-kit push --force` for dev).

### `users`
Fields: `id`, `email`, `password_hash`, `name`, `company`, `role` (enum: `founder|admin`), `email_verified`, `created_at`, `updated_at`

### `candidates`
The main vetted candidate pool. Fields: `id`, `internal_id`, `real_name`, `anonymized_headline`, `role_category` (enum), `seniority` (enum), `years_experience`, `location`, `open_to_relocation`, `comp_range_min`, `comp_range_max`, `top_skills` (text[]), `summary_blurb`, `notable_credentials`, `status` (enum: `opted_in|paused|placed|withdrawn`), `date_added`

Real names are **never** exposed to founders — only `anonymized_headline` and metadata.

### `intro_requests`
Tracks founder → candidate interest. Fields: `id`, `founder_id` (FK → users), `candidate_id` (FK → candidates), `status` (enum: `requested|offered|intro_made|placed|closed`), `request_type` (text: `"intro"` or `"more_info"`), `requested_at`

### `te_prospective_cache`
Anonymized cache of TE pipeline candidates. PK is `te_id` (Top Echelon's person ID, or `MANUAL-*` prefix for manual entries). Fields: `te_id`, `anonymized_headline`, `role_category`, `seniority`, `location`, `top_skills`, `summary_blurb`, `education_level`, `years_experience_estimate`, `comp_expectation`, `last_synced_at`, `screening_date`

GET `/prospective` deduplicates by `role_category` — one entry per category (most recently synced TE record wins). Manual entries (`MANUAL-` prefix) are always shown individually.

### `te_interests`
Tracks founder interest expressions on prospective candidates. Unique constraint on `(te_id, founder_id)`. Fields: `id`, `te_id`, `founder_id`, `note`, `expressed_at`

### `domains`
Portfolio company email domain whitelist. Fields: `id`, `domain`, `company_name`, `created_at`

### `email_verification_tokens`
Short-lived tokens for email verification. (Not used for `@activeimpactinvestments.com` signups.)

---

## 5. API Routes

All routes under `/api/`.

```
GET    /api/healthz                          — health check
GET    /api/auth/me                          — current session user
POST   /api/auth/signup                      — register
POST   /api/auth/login                       — login
POST   /api/auth/logout                      — logout
POST   /api/auth/verify-email                — verify token
POST   /api/auth/resend-verification         — resend token

GET    /api/candidates                       — list active candidates (founders)
GET    /api/candidates/:internalId           — single candidate (founders)
GET    /api/intro-requests                   — founder's own requests
POST   /api/intro-requests                   — request intro or more info (fires Zapier)

GET    /api/prospective                      — deduped TE pipeline (founders)
POST   /api/prospective/:teId/interest       — express interest (fires Zapier)

# Admin only
GET    /api/admin/stats
GET    /api/admin/candidates
POST   /api/admin/candidates
PUT    /api/admin/candidates/:internalId
DELETE /api/admin/candidates/:internalId
GET    /api/admin/intro-requests
GET    /api/admin/domains
POST   /api/admin/domains
DELETE /api/admin/domains/:domain
GET    /api/admin/prospective
POST   /api/admin/prospective                — manual add to prospective
DELETE /api/admin/prospective/:teId
POST   /api/admin/prospective/bulk-sync      — replace all TE records with new batch
```

---

## 6. Frontend Pages

All in `artifacts/talent-hub/src/pages/`:

| File | Route | Who sees it |
|---|---|---|
| `login.tsx` | `/talent-hub/login` | Public |
| `signup.tsx` | `/talent-hub/signup` | Public |
| `verify-email.tsx` | `/talent-hub/verify-email` | Public |
| `dashboard.tsx` | `/talent-hub/` | Founders |
| `candidate-profile.tsx` | `/talent-hub/candidates/:id` | Founders |
| `prospective.tsx` | `/talent-hub/prospective` | Founders |
| `my-requests.tsx` | `/talent-hub/my-requests` | Founders |
| `profile.tsx` | `/talent-hub/profile` | Founders |
| `admin/` | `/talent-hub/admin/*` | Admins |

---

## 7. Zapier Webhook Integration

A Zapier webhook fires server-side (fire-and-forget, non-blocking) on three actions:

| Action | `requestType` in payload |
|---|---|
| Request Intro button | `"Intro"` |
| More Info dialog submit | `"More Info"` |
| Submit Interest on Prospective page | `"Prospective Interest"` |

The webhook URL is stored in the environment secret `ZAPIER_INTRO_REQUEST_WEBHOOK_URL`.

Payload includes: `requestType`, founder name/email/company, candidate headline/category, timestamp.

Files: `artifacts/api-server/src/routes/intro-requests.ts`, `artifacts/api-server/src/routes/prospective.ts`

---

## 8. Top Echelon (TE) Sync — Critical to Understand

**Top Echelon is the recruiter's ATS.** The Prospective tab shows anonymized candidates from TE's pipeline. This is the most complex and currently incomplete part of the system.

### How sync works today
TE data is accessed via a **custom MCP server** (`top_echelon_-_nathan_s_custom`). MCP callbacks (`mcpTopEchelonNathanSCustom_*`) **only work inside Replit's CodeExecution sandbox** — they cannot be called from Express routes.

Sync is therefore a **manual, agent-run process**:
1. Agent runs a CodeExecution script
2. Calls `searchPeople` or `listPersonActivities` to find candidates at the `1st Screen` pipeline stage
3. Calls `getPerson` for each to get full details
4. Maps TE fields → `te_prospective_cache` schema
5. Writes directly to the DB via `executeSql`
6. Uses `POST /api/admin/prospective/bulk-sync` or direct SQL to update the cache

### Known TE limitations
- **`searchPeople` pagination is broken** — always returns page 1 regardless of `page` param. Only ~16 most recent people are accessible via the 32KB MCP response truncation limit.
- `listPersonActivities` returns `{ pagination, results: [] }` — not a flat array.
- Discovery Calls are logged in TE as "Status Update" activity type with "Discovery Call" in the title.
- `compExpectation` / `desired_compensation` is not populated in TE for any current candidates.

### What still needs to be built — THE MAIN OUTSTANDING TASK
**Proper TE integration so sync can happen without agent intervention.** Options:
1. A server-side sync endpoint that calls TE's REST API directly (requires TE API credentials, not MCP)
2. A scheduled CodeExecution job the agent runs periodically
3. An admin UI trigger that somehow proxies through CodeExecution

The "Sync from TE" button in the admin UI currently calls a non-existent `pnpm run sync:te` script — **it does nothing**. This needs to be wired up properly.

Skill reference: `.local/mcp_skills/top_echelon_-_nathan_s_custom/SKILL.md`

---

## 9. Environment Variables & Secrets

| Secret / Env Var | Purpose | Where set |
|---|---|---|
| `SESSION_SECRET` | express-session signing | Replit Secrets |
| `ZAPIER_INTRO_REQUEST_WEBHOOK_URL` | Zapier webhook for intro/interest actions | Replit Secrets |
| `DATABASE_URL` | Postgres connection (Replit-managed DB) | Auto-injected by Replit |
| `NODE_ENV` | Set to `development` in dev workflow; `production` in deployment | workflow / deploy |

Access via `process.env.*` in the API server. Never hard-code or log these.

---

## 10. Known Issues & Limitations

| Issue | Detail |
|---|---|
| TE sync is agent-only | No working automated sync. Admin "Sync from TE" button calls a non-existent script. |
| TE pagination broken | Only the ~16 most recent TE people are reachable via MCP. |
| `compExpectation` always null | Column exists and renders in UI, but TE has no comp data filled in. Will auto-populate on next sync if recruiters update TE. |
| `note` field on More Info | Passed to API as `note` via `any` cast — not in the official Zod schema. Works at runtime but is technically unvalidated. |
| Deduplication is naive | One entry per `role_category`. If TE has multiple strong candidates in the same category, only the most recently synced one shows. |
| No candidate pagination | Dashboard loads all active candidates at once. Fine for current volume; will need pagination at scale. |

---

## 11. Outstanding / Future Work

1. **TE direct integration** — Wire the admin "Sync from TE" button to actually pull from Top Echelon. Ideal path: call TE REST API from the server directly, bypassing MCP. Nathan has the TE API credentials.
2. **Founder onboarding flow** — Currently founders land on the dashboard after verification with no guidance. An onboarding step or welcome screen would help.
3. **Candidate pagination** — Low priority now, but needed as the pool grows.
4. **Comp expectation data** — Will auto-populate once recruiters fill in TE; no code change needed.
5. **Better TE deduplication** — Consider showing multiple candidates per role category with a priority/rank signal from TE.
6. **Active Impact branding pass** — Nathan wants the UI to reflect the Active Impact brand more strongly. Typography, colour palette, and copy tone should align with their brand guidelines.

---

## 12. Repo Structure (Key Paths)

```
artifacts/
  api-server/          — Express API (build output: dist/index.mjs)
    src/
      app.ts           — Express app setup, session, middleware
      routes/          — Route handlers
      middlewares/     — requireAuth, requireAdmin
  talent-hub/          — React frontend
    src/
      pages/           — Page components
      components/      — Shared UI components
  mockup-sandbox/      — Design canvas preview server (ignore for feature work)

lib/
  db/
    src/
      schema/          — Drizzle table definitions
      index.ts         — Exports db client + all tables
  api-zod/             — Shared Zod schemas for API request/response validation

.local/
  mcp_skills/          — MCP server skill docs (read before using TE MCP)
  skills/              — Replit agent skills

HANDOFF.md             — This file
replit.md              — Project overview & user preferences
```
