#!/usr/bin/env bash
# Regenerate Keycloak-related secrets in .env.prod (source of truth for compose).
# Postgres uses default Docker workflow: POSTGRES_USER=keycloak, POSTGRES_DB=keycloak, POSTGRES_PASSWORD=KEYCLOAK_DB_PASSWORD.
#
# Usage:
#   ./scripts/generate-dev-secrets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_PROD="$ROOT_DIR/.env.prod"

all_vars='KEYCLOAK_ADMIN_PASSWORD|KEYCLOAK_DB_PASSWORD'

touch "$ENV_PROD"

if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(sed -i -E)
else
  SED_INPLACE=(sed -i '' -E)
fi

# Remove existing lines for these vars
"${SED_INPLACE[@]}" "/^(${all_vars})=/d" "$ENV_PROD"
{
  echo "KEYCLOAK_ADMIN_PASSWORD=$(openssl rand -base64 24)"
  echo "KEYCLOAK_DB_PASSWORD=$(openssl rand -base64 24)"
} >> "$ENV_PROD"
echo "Regenerated KEYCLOAK_ADMIN_PASSWORD and KEYCLOAK_DB_PASSWORD in .env.prod."

# Sync to .env if present (for local compose)
if [ -f "$ROOT_DIR/.env" ]; then
  "${SED_INPLACE[@]}" "/^(${all_vars})=/d" "$ROOT_DIR/.env"
  grep -E "^(${all_vars})=" "$ENV_PROD" >> "$ROOT_DIR/.env" || true
  echo "Synced .env from .env.prod."
fi
