#!/usr/bin/env bash
# Switch local Node for development: write .nvmrc and activate with fnm.
# Usage: npm run dev:node -- <version>
# Example: npm run dev:node -- 24
set -euo pipefail

version="${1:-}"
if [[ -z "${version}" ]]; then
  echo "usage: npm run dev:node -- <version>" >&2
  echo "example: npm run dev:node -- 24" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "${repo_root}"

printf '%s\n' "${version}" > .nvmrc

if ! command -v fnm >/dev/null 2>&1; then
  echo "error: fnm is not on PATH; install fnm and ensure it is initialized in your shell." >&2
  exit 1
fi

fnm use
node -v
