# Active Impact Talent Hub

A private talent marketplace for Active Impact Investments (Canada's largest climate tech seed fund) where portfolio company founders browse anonymized, pre-vetted candidates and request intros.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/talent-hub run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (runtime-managed)
- Required env: `SESSION_SECRET` — secret for express-session

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter, TanStack Query, Tailwind CSS
- API: Express 5, session-based auth (express-session + connect-pg-simple)
- DB: PostgreSQL + Drizzle ORM
- Auth: bcryptjs passwords, domain whitelist for founder signups
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Fonts: Poppins (headings/UI), IBM Plex Mono (stats/data values)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/db/src/schema/` — Drizzle schema (users, candidates, intro_requests, domains, email_verification_tokens)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth, requireAdmin, requireVerified middleware
- `artifacts/talent-hub/src/` — React frontend
- `artifacts/talent-hub/src/hooks/use-auth.tsx` — AuthProvider, ProtectedRoute, useAuth

## Architecture decisions

- **Session-based auth** — httpOnly cookies, 7-day sessions stored in Postgres via connect-pg-simple
- **Role enforcement at query level** — candidate realName/internalId never included in founder-facing responses; enforced in route handlers, not just UI
- **Domain whitelist** — founders can only sign up with email domains in the `domains` table; rejection message directs them to contact Active Impact team
- **Email verification** — token stored in DB, 24h expiry; for demo purposes the token is included in the signup response message
- **Anonymized by default** — candidate identity fields excluded at the DB query level for founder sessions

## Seed Data

- 10 candidates across Engineering, Sales, Operations, Product, Finance, Marketing, Executive
- 2 whitelisted domains: `greenpath.io` (GreenPath Technologies), `solartechcorp.ca` (Solar Tech Corp)
- Admin: `admin@activeimpact.ca` / `ActiveImpact2025!`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After OpenAPI spec changes, always run `pnpm --filter @workspace/api-spec run codegen` before typechecking artifact packages
- `format: email` in OpenAPI spec causes Orval to generate `zod.email()` which doesn't exist on the zod v3 default export — omit email format from the spec
- Email verification tokens are returned in the signup response message for demo purposes (no email sending configured)
- The `candidates/breakdown` route must be declared before `candidates/:id` in Express to avoid routing conflicts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
