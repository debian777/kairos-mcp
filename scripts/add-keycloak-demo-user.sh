#!/usr/bin/env bash
# Add a demo user to Keycloak realm kairos-dev using the Admin CLI (kcadm.sh) inside the container.
# Requires: Keycloak running (docker compose --env-file .env.prod --profile infra up -d).
#
# Usage:
#   ./scripts/add-keycloak-demo-user.sh
#   DEMO_PASSWORD=mysecret ./scripts/add-keycloak-demo-user.sh
#
# Reads KEYCLOAK_ADMIN_PASSWORD from .env.prod (or .env). Creates user "demo" in kairos-dev
# with password from DEMO_PASSWORD (default: demo).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Load admin password from .env.prod or .env
if [ -f "$ROOT_DIR/.env.prod" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env.prod"
  set +a
elif [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env"
  set +a
fi

if [ -z "${KEYCLOAK_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: KEYCLOAK_ADMIN_PASSWORD not set. Add it to .env.prod or .env and run again." >&2
  exit 1
fi

DEMO_USER="${DEMO_USER:-demo}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo}"
REALM="${REALM:-kairos-dev}"

# Resolve Keycloak container (compose project from ROOT_DIR)
CONTAINER=$(docker compose --env-file .env.prod -f compose.yaml ps -q keycloak 2>/dev/null || true)
if [ -z "$CONTAINER" ]; then
  echo "ERROR: Keycloak container not running. Start with: docker compose --env-file .env.prod --profile infra up -d" >&2
  exit 1
fi

echo "Adding demo user '$DEMO_USER' to realm '$REALM' (container: $CONTAINER)..."

docker exec \
  -e KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD" \
  -e DEMO_PASSWORD="$DEMO_PASSWORD" \
  -e DEMO_USER="$DEMO_USER" \
  -e REALM="$REALM" \
  "$CONTAINER" /bin/bash -c '
  /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password "$KEYCLOAK_ADMIN_PASSWORD" && \
  /opt/keycloak/bin/kcadm.sh create users -r "$REALM" -s username="$DEMO_USER" -s enabled=true 2>/dev/null || true && \
  /opt/keycloak/bin/kcadm.sh set-password -r "$REALM" --username "$DEMO_USER" --new-password "$DEMO_PASSWORD"
'

echo "Done. Demo user: $DEMO_USER / $DEMO_PASSWORD (realm: $REALM, Admin UI: http://localhost:8080)"
