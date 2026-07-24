import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

// Self-hosting: when the built frontend has been copied next to the server
// bundle (dist/public), Express serves it directly — no external router needed.
// On Replit (where the frontend build lives elsewhere) this dir is absent, so
// static serving self-disables and Replit's own router keeps serving the SPA.
const clientDir = path.join(__dirname, "public");
const hasClient = fs.existsSync(path.join(clientDir, "index.html"));
const rawBase = process.env.BASE_PATH || "/";
const baseMount = rawBase === "/" ? "" : rawBase.replace(/\/+$/, "");

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const PgSession = connectPgSimple(session);
const app: Express = express();

// Trust the Replit proxy so express-rate-limit can read X-Forwarded-For correctly
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Serve hashed frontend assets before the session middleware so static files
// never touch the session store. Mounted at the frontend's base path.
if (hasClient) {
  app.use(baseMount || "/", express.static(clientDir, { index: false, maxAge: "1h" }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

// SPA fallback: any non-API GET returns index.html so client-side routing works
// on deep links / refreshes. Runs after /api so unknown API routes still 404.
if (hasClient) {
  const indexHtml = path.join(clientDir, "index.html");
  if (baseMount) {
    app.get("/", (_req, res) => res.redirect(`${baseMount}/`));
  }
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(indexHtml);
  });
}

export default app;
