---
name: TE sync architecture
description: How TE (Top Echelon) data flows into the talent hub and key constraints.
---

## Architecture
MCP callbacks (`mcpTopEchelonNathanSCustom_*`) only work inside CodeExecution sandbox — NOT from Express server process. Resolution: DB cache architecture — CodeExecution sync script populates `te_prospective_cache` table; Express serves from that table.

## Session table
`connect-pg-simple` with `createTableIfMissing: true` does NOT auto-create the table on first boot. Must be created manually:
```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

## Trust proxy
`app.set("trust proxy", 1)` is required in app.ts to prevent express-rate-limit ValidationError about X-Forwarded-For header.

**Why:** Replit runs behind a proxy that sets X-Forwarded-For; without trust proxy, rate limiting throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
