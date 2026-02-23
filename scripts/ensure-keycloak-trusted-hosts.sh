#!/usr/bin/env bash
# Ensure Keycloak Client Registration → Trusted Hosts allows DCR (e.g. Cursor MCP).
# Usage: ./scripts/ensure-keycloak-trusted-hosts.sh dev|qa

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

ENV="${1:-}"
if [ "$ENV" != "dev" ] && [ "$ENV" != "qa" ]; then
  echo "Usage: $0 dev|qa" >&2
  exit 1
fi

[ -f "$ROOT_DIR/.env" ] && set -a && source "$ROOT_DIR/.env" && set +a
[ "$ENV" = "dev" ] && [ -f "$ROOT_DIR/.env.dev" ] && set -a && source "$ROOT_DIR/.env.dev" && set +a
[ "$ENV" = "qa" ] && [ -f "$ROOT_DIR/.env.qa" ] && set -a && source "$ROOT_DIR/.env.qa" && set +a
[ "$ENV" = "qa" ] && [ -f "$ROOT_DIR/.env.dev" ] && [ ! -f "$ROOT_DIR/.env.qa" ] && set -a && source "$ROOT_DIR/.env.dev" && set +a

if [ "$ENV" = "dev" ]; then
  KEYCLOAK_URL="${KEYCLOAK_DEV_URL:-http://localhost:8080}"
  REALM="${KEYCLOAK_DEV_REALM:-kairos-dev}"
else
  KEYCLOAK_URL="${KEYCLOAK_QA_URL:-${KEYCLOAK_DEV_URL:-http://localhost:8080}}"
  REALM="${KEYCLOAK_QA_REALM:-kairos-qa}"
fi

python3 "$SCRIPT_DIR/ensure_keycloak_trusted_hosts.py" --keycloak-url "$KEYCLOAK_URL" --realm "$REALM"
