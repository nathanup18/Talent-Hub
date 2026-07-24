# Self-hosting the Talent Hub

The app is a single Node service: Express serves the API at `/api/*` and the
built React frontend for everything else. One process, one container, any host.

## Build & run locally

```bash
pnpm install
pnpm run build:selfhost   # builds server + frontend, colocates them
pnpm start                # node artifacts/api-server/dist/index.mjs
```

## Required environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon) |
| `SESSION_SECRET` | express-session signing secret |
| `PORT` | Port to listen on (most hosts set this automatically) |
| `BASE_PATH` | Frontend base path. `/` for a dedicated domain (default in Docker) |
| `TE_SYNC_URL` | `https://te-recruit-mcp.nathan-545.workers.dev` (Top Echelon bridge) |
| `TE_SYNC_SECRET` | Shared secret for the bridge |
| `ZAPIER_INTRO_REQUEST_WEBHOOK_URL` | Zapier webhook for intro/interest actions |
| `NODE_ENV` | `production` on a deployed host (enables secure cookies) |

Apply the schema to the database once per environment:

```bash
DATABASE_URL=... pnpm --filter @workspace/db run push
```

## Deploy with Docker (Render, Railway, Fly, any host)

The repo includes a `Dockerfile` that builds and runs the whole app.

- **Render:** New → Web Service → connect the GitHub repo → Runtime: Docker.
  Add the env vars above. Every push to `main` auto-deploys. HTTPS is automatic,
  so `NODE_ENV=production` secure cookies work.
- **Railway:** New Project → Deploy from GitHub repo. It detects the Dockerfile.
  Add the env vars. Auto-deploys on push.
- **Fly.io:** `fly launch` (uses the Dockerfile), set secrets with
  `fly secrets set KEY=value`, then `fly deploy`.

No database add-on is needed on the host — the app uses the external
`DATABASE_URL` (Neon).
