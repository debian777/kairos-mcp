#!/usr/bin/env bash
# Portable SHA-256 hex digest (shell-only, no Node). Optional local helper.
# For AI/remote: use the one-liner from docs/workflow-after-phase2.md (Generating hashes).
#
# Usage: echo -n 'content' | ./scripts/sha256.sh   or   ./scripts/sha256.sh 'content'
set -e
if [ -n "$1" ]; then
  printf '%s' "$1"
else
  cat
fi | if command -v sha256sum >/dev/null 2>&1; then
  sha256sum
else
  shasum -a 256
fi | awk '{print $1}'
