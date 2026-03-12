import express from "express";
import type { AuthPayload } from "./http-auth-middleware.js";

/**
 * GET /api/me — current user from session or Bearer (for UI account page).
 * Requires auth. Returns sub; name/email when present in token.
 */
export function setupMeRoute(app: express.Express): void {
  app.get("/api/me", (req: express.Request & { auth?: AuthPayload }, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
      return;
    }
    res.status(200).json({
      sub: auth.sub,
      name: (auth as { name?: string }).name ?? auth.sub,
      email: (auth as { email?: string }).email ?? undefined,
    });
  });
}
