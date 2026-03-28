import express from "express";
import type { MeResponse } from "../me-response.js";
import type { AuthPayload } from "./http-auth-middleware.js";
import { deriveAccountKindAndLabel } from "./oidc-profile-claims.js";

function buildMeResponse(auth: AuthPayload): MeResponse {
  const derived = deriveAccountKindAndLabel(auth.identity_provider);
  const account_kind = auth.account_kind ?? derived.account_kind;
  const account_label = auth.account_label ?? derived.account_label;
  const body: MeResponse = {
    sub: auth.sub,
    groups: auth.groups,
    realm: auth.realm,
    account_kind,
    account_label,
  };
  if (auth.preferred_username !== undefined) body.preferred_username = auth.preferred_username;
  if (auth.name !== undefined) body.name = auth.name;
  if (auth.given_name !== undefined) body.given_name = auth.given_name;
  if (auth.family_name !== undefined) body.family_name = auth.family_name;
  if (auth.email !== undefined) body.email = auth.email;
  if (auth.email_verified !== undefined) body.email_verified = auth.email_verified;
  if (auth.identity_provider !== undefined) body.identity_provider = auth.identity_provider;
  return body;
}

/**
 * GET /api/me — current user from session or Bearer (for UI account page).
 * Requires auth. Returns whitelisted profile and authorization fields.
 */
export function setupMeRoute(app: express.Express): void {
  app.get("/api/me", (req: express.Request & { auth?: AuthPayload }, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
      return;
    }
    res.status(200).json(buildMeResponse(auth));
  });
}
