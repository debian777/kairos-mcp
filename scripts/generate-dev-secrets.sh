#!/usr/bin/env bash
# Generate infra secrets (.env) and dev app config (.env.dev) for use with compose.yaml.
# - .env       = infra secrets (Keycloak, Postgres). Compose services use env_file: .env.
# - .env.dev   = app config from env.example.txt template; CI can inject OPENAI_API_KEY etc.
# Does not override existing secrets by default; use --force to replace.
#
# Usage:
#   ./scripts/generate-dev-secrets.sh [--force] [--ci]
#   CI=1 OPENAI_API_KEY=sk-... ./scripts/generate-dev-secrets.sh --ci
#
# Env (optional): KEYCLOAK_ADMIN_PASSWORD, KEYCLOAK_DB_PASSWORD, SESSION_SECRET, OPENAI_API_KEY

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_INFRA="$ROOT_DIR/.env"
ENV_DEV="$ROOT_DIR/.env.dev"
TEMPLATE="$ROOT_DIR/env.example.txt"

FORCE=false
CI=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --ci)    CI=true ;;
  esac
done

# Portable sed inplace
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(sed -i -E)
else
  SED_INPLACE=(sed -i '' -E)
fi

# Set a var in file: value only if missing (or FORCE). Value from env, then default.
set_var() {
  local file="$1"
  local name="$2"
  local default="$3"
  local val="${!name}"
  val="${val:-$default}"
  if [ -z "$val" ]; then
    return 0
  fi
  if grep -q "^${name}=" "$file" 2>/dev/null; then
    if [ "$FORCE" = true ]; then
      "${SED_INPLACE[@]}" "/^${name}=/d" "$file"
      echo "${name}=${val}" >> "$file"
    fi
  else
    echo "${name}=${val}" >> "$file"
  fi
}

# --- .env (infra secrets) ---
touch "$ENV_INFRA"
# Use existing .env values so we don't rotate secrets; only generate when missing
get_existing() { grep -E "^${1}=" "$ENV_INFRA" 2>/dev/null | sed -E 's/^[^=]+=//' | head -1; }
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-$(get_existing KEYCLOAK_ADMIN_PASSWORD)}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-$(openssl rand -base64 24)}"
KEYCLOAK_DB_PASSWORD="${KEYCLOAK_DB_PASSWORD:-$(get_existing KEYCLOAK_DB_PASSWORD)}"
KEYCLOAK_DB_PASSWORD="${KEYCLOAK_DB_PASSWORD:-$(openssl rand -base64 24)}"
set_var "$ENV_INFRA" KEYCLOAK_ADMIN_PASSWORD "$KEYCLOAK_ADMIN_PASSWORD"
set_var "$ENV_INFRA" KEYCLOAK_DB_PASSWORD "$KEYCLOAK_DB_PASSWORD"
echo "Ensured infra secrets in .env (Keycloak/Postgres)."

# --- .env.dev (from template) ---
if [ ! -f "$ENV_DEV" ]; then
  if [ -f "$TEMPLATE" ]; then
    cp "$TEMPLATE" "$ENV_DEV"
    echo "Created .env.dev from env.example.txt."
  else
    touch "$ENV_DEV"
    echo "Created empty .env.dev (env.example.txt not found)."
  fi
fi

# Dev/CI required vars (same KEYCLOAK_* as .env for consistency)
set_var "$ENV_DEV" KEYCLOAK_ADMIN_PASSWORD "$KEYCLOAK_ADMIN_PASSWORD"
set_var "$ENV_DEV" KEYCLOAK_DB_PASSWORD "$KEYCLOAK_DB_PASSWORD"

if [ "$CI" = true ]; then
  SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
  set_var "$ENV_DEV" REDIS_URL "redis://127.0.0.1:6379"
  set_var "$ENV_DEV" QDRANT_URL "http://127.0.0.1:6333"
  set_var "$ENV_DEV" AUTH_ENABLED "true"
  set_var "$ENV_DEV" KEYCLOAK_URL "http://localhost:8080"
  set_var "$ENV_DEV" KEYCLOAK_REALM "kairos-dev"
  set_var "$ENV_DEV" KEYCLOAK_CLIENT_ID "kairos-mcp"
  set_var "$ENV_DEV" AUTH_CALLBACK_BASE_URL "http://localhost:3300"
  set_var "$ENV_DEV" SESSION_SECRET "$SESSION_SECRET"
  set_var "$ENV_DEV" OPENAI_API_KEY "${OPENAI_API_KEY:-}"
  echo "Set CI defaults and env overrides in .env.dev."
fi

echo "Done. Use: docker compose --env-file .env.dev --profile infra up -d"
