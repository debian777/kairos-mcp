#!/usr/bin/env bash
# One-time setup + verify: build, realm config, login (browser), then search.
# Exit 0 only if "npm run cli:dev -- search test" succeeds.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .env ] && set -a && source .env && set +a
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
[[ "$KEYCLOAK_URL" =~ ^https?://keycloak: ]] && KEYCLOAK_URL="http://localhost:8080"
export KEYCLOAK_URL

if [ ! -f dist/cli/index.js ]; then
  npm run build
fi
if [ -n "${KEYCLOAK_ADMIN_PASSWORD:-}" ] && [ -f scripts/deploy-configure-keycloak-realms.py ]; then
  python3 scripts/deploy-configure-keycloak-realms.py
fi
echo "Complete login in the browser when it opens."
npm run cli:dev -- login
out=$(npm run cli:dev --silent -- search "test" 2>&1) || exit 1
echo "$out" | grep -q '"choices"' || exit 1
echo "OK"
exit 0
