import { type Request, type Response, type NextFunction } from "express";

// Extend session type
declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: "founder" | "admin";
    emailVerified: boolean;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.session.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.session.emailVerified) {
    res.status(403).json({ error: "Email not verified" });
    return;
  }
  next();
}
