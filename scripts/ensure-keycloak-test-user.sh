#!/usr/bin/env bash
# Ensure the Keycloak test user (hardcoded kairos-tester / kairos-tester-secret) exists
# in the given env's Keycloak. Uses scripts/add_keycloak_user.py.
#
# Usage:
#   ./scripts/ensure-keycloak-test-user.sh dev
#   ./scripts/ensure-keycloak-test-user.sh qa
#
# Requires: .env with KEYCLOAK_ADMIN_PASSWORD.
# For dev: KEYCLOAK_DEV_URL from .env.dev (default http://localhost:8080), realm kairos-dev.
# For qa: KEYCLOAK_QA_URL from .env.qa or .env.dev (default http://localhost:8080), realm kairos-qa.

set -e

# Hardcoded test user for dev/qa (same as tests/utils/keycloak-container.ts)
TEST_USERNAME="kairos-tester"
TEST_PASSWORD="kairos-tester-secret"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

ENV="${1:-}"
if [ "$ENV" != "dev" ] && [ "$ENV" != "qa" ]; then
  echo "Usage: $0 dev|qa" >&2
  exit 1
fi

# Load .env (KEYCLOAK_ADMIN_PASSWORD)
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env"
  set +a
fi

# Load env-specific file for Keycloak URL and realm
if [ "$ENV" = "dev" ] && [ -f "$ROOT_DIR/.env.dev" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env.dev"
  set +a
elif [ "$ENV" = "qa" ] && [ -f "$ROOT_DIR/.env.qa" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env.qa"
  set +a
fi
if [ "$ENV" = "qa" ] && [ -f "$ROOT_DIR/.env.dev" ] && [ ! -f "$ROOT_DIR/.env.qa" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env.dev"
  set +a
fi

if [ -z "${KEYCLOAK_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: KEYCLOAK_ADMIN_PASSWORD not set in .env" >&2
  exit 1
fi

if [ "$ENV" = "dev" ]; then
  KEYCLOAK_URL="${KEYCLOAK_DEV_URL:-http://localhost:8080}"
  REALM="${KEYCLOAK_DEV_REALM:-kairos-dev}"
else
  KEYCLOAK_URL="${KEYCLOAK_QA_URL:-${KEYCLOAK_DEV_URL:-http://localhost:8080}}"
  REALM="${KEYCLOAK_QA_REALM:-kairos-qa}"
fi

echo "Ensuring Keycloak test user for $ENV: realm=$REALM user=$TEST_USERNAME (keycloak=$KEYCLOAK_URL)..."

python3 "$SCRIPT_DIR/add_keycloak_user.py" \
  --keycloak-url "$KEYCLOAK_URL" \
  --realm "$REALM" \
  --user "$TEST_USERNAME" \
  --password "$TEST_PASSWORD"

# So Cursor MCP (DCR) can connect: relax Trusted Hosts for client registration
python3 "$SCRIPT_DIR/ensure_keycloak_trusted_hosts.py" \
  --keycloak-url "$KEYCLOAK_URL" \
  --realm "$REALM" || true

echo "Done. Test user $TEST_USERNAME ready in realm $REALM."
