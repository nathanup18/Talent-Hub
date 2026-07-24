# Single self-hostable image: builds the API server (esbuild bundle) and the
# frontend (Vite), colocates the frontend under the server so Express serves
# both the SPA and /api from one process. Deploys on Render / Railway / Fly /
# any Docker host. Provide env at runtime: DATABASE_URL, SESSION_SECRET,
# TE_SYNC_URL, TE_SYNC_SECRET, ZAPIER_INTRO_REQUEST_WEBHOOK_URL. PORT is
# supplied by the platform.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
# Frontend is served at the domain root; bake that base path into the build.
RUN BASE_PATH=/ PORT=5000 pnpm run build:selfhost

FROM node:24-slim AS run
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
ENV BASE_PATH=/
# App code + the externalized runtime deps (connect-pg-simple, pg, pino-pretty…)
COPY --from=build /app /app
CMD ["node", "artifacts/api-server/dist/index.mjs"]
