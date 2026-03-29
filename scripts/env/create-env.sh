#!/usr/bin/env bash
# Create repo-root .env from scripts/env/.env.template when missing (secrets generated or from env).
# Does not overwrite an existing .env — remove or rename it first if you want a fresh file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then
  echo ".env already exists at $ROOT/.env — not overwriting. Remove or rename it to create a new one."
  exit 0
fi
exec python3 scripts/deploy-generate-dev-secrets.py
