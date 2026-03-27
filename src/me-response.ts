/**
 * JSON shape for GET /api/me (session or Bearer). Shared by HTTP handler and UI consumer.
 */
export type MeAccountKind = "local" | "sso";

export interface MeResponse {
  sub: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  groups: string[];
  realm: string;
  group_ids?: string[];
  identity_provider?: string;
  account_kind: MeAccountKind;
  account_label: string;
}
