#!/usr/bin/env bash
# Regenerate password vars: .env.prod is the source of truth (compose + 02-kairos-dbs.sh use it).
# 1) Generate six values and write only to .env.prod.
# 2) Set POSTGRES_URL in .env.prod, .env.dev, .env.qa (app SSO/sessions) from kairos_* user/password.
# 3) Sync .env with all six vars from .env.prod (for local compose).
#
# Usage:
#   ./scripts/generate-dev-secrets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_PROD="$ROOT_DIR/.env.prod"

all_vars='POSTGRES_PASSWORD|KEYCLOAK_ADMIN_PASSWORD|KEYCLOAK_DB_PASSWORD|KAIROS_DEV_DB_PASSWORD|KAIROS_QA_DB_PASSWORD|KAIROS_PROD_DB_PASSWORD'

# Ensure .env.prod exists
touch "$ENV_PROD"

# Use extended regex (-E) so | alternation works (BSD sed treats | as literal in BRE)
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(sed -i -E)
else
  SED_INPLACE=(sed -i '' -E)
fi

# Helper: get value from .env.prod (line ^VAR=value; value is everything after first =)
get_from_prod() { grep -E "^${1}=" "$ENV_PROD" | cut -d= -f2-; }

# 1) Generate and write only to .env.prod (source of truth). Delete ALL lines matching any of the six vars and POSTGRES_URL.
"${SED_INPLACE[@]}" "/^(${all_vars}|POSTGRES_URL)=/d" "$ENV_PROD"
{
  echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
  echo "KEYCLOAK_ADMIN_PASSWORD=$(openssl rand -base64 24)"
  echo "KEYCLOAK_DB_PASSWORD=$(openssl rand -base64 24)"
  echo "KAIROS_DEV_DB_PASSWORD=$(openssl rand -base64 24)"
  echo "KAIROS_QA_DB_PASSWORD=$(openssl rand -base64 24)"
  echo "KAIROS_PROD_DB_PASSWORD=$(openssl rand -base64 24)"
} >> "$ENV_PROD"

# POSTGRES_URL for prod (app SSO/sessions → kairos_prod DB). URL-encode password for safety.
prod_pass=$(get_from_prod "KAIROS_PROD_DB_PASSWORD")
prod_pass_enc=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$prod_pass")
echo "POSTGRES_URL=postgres://kairos_prod:${prod_pass_enc}@localhost:5432/kairos_prod" >> "$ENV_PROD"
echo "Regenerated password vars and POSTGRES_URL in .env.prod (source of truth)."

# 2) Sync from .env.prod: .env gets all six vars; .env.dev and .env.qa get POSTGRES_URL only.
if [ -f "$ROOT_DIR/.env" ]; then
  "${SED_INPLACE[@]}" "/^(${all_vars}|POSTGRES_URL)=/d" "$ROOT_DIR/.env"
  grep -E "^(${all_vars})=" "$ENV_PROD" >> "$ROOT_DIR/.env" || true
  fgrep 'POSTGRES_URL=' "$ENV_PROD" >> "$ROOT_DIR/.env" || true
  echo "Synced .env from .env.prod."
fi

# .env.dev: POSTGRES_URL (app SSO/sessions → kairos_dev DB)
if [ -f "$ROOT_DIR/.env.dev" ]; then
  "${SED_INPLACE[@]}" "/^(KAIROS_DEV_DB_PASSWORD|POSTGRES_URL)=/d" "$ROOT_DIR/.env.dev"
  dev_pass=$(get_from_prod "KAIROS_DEV_DB_PASSWORD")
  dev_pass_enc=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$dev_pass")
  echo "POSTGRES_URL=postgres://kairos_dev:${dev_pass_enc}@localhost:5432/kairos_dev" >> "$ROOT_DIR/.env.dev"
  echo "Synced .env.dev from .env.prod (POSTGRES_URL)."
fi

# .env.qa: POSTGRES_URL (app SSO/sessions → kairos_qa DB)
if [ -f "$ROOT_DIR/.env.qa" ]; then
  "${SED_INPLACE[@]}" "/^(KAIROS_QA_DB_PASSWORD|POSTGRES_URL)=/d" "$ROOT_DIR/.env.qa"
  qa_pass=$(get_from_prod "KAIROS_QA_DB_PASSWORD")
  qa_pass_enc=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$qa_pass")
  echo "POSTGRES_URL=postgres://kairos_qa:${qa_pass_enc}@localhost:5432/kairos_qa" >> "$ROOT_DIR/.env.qa"
  echo "Synced .env.qa from .env.prod (POSTGRES_URL)."
fi
