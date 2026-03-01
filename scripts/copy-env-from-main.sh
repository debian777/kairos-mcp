#!/usr/bin/env bash
# Copy .env from the main git worktree into the current workspace.
# Usage: ./scripts/copy-env-from-main.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

main_root=""
if ! main_root=$(git -C "$PROJECT_DIR" worktree list 2>/dev/null | head -1 | awk '{print $1}'); then
    echo "Not a git worktree or git failed. Cannot resolve main directory." >&2
    exit 1
fi

# Normalize path (resolve symlinks, remove trailing slash)
main_root="$(cd "$main_root" 2>/dev/null && pwd)"
if [ -z "$main_root" ] || [ ! -d "$main_root" ]; then
    echo "Main worktree path missing or not a directory: $main_root" >&2
    exit 1
fi

if [ "$main_root" = "$PROJECT_DIR" ]; then
    echo "Current directory is the main worktree; nothing to copy."
    exit 0
fi

if [ ! -f "$main_root/.env" ]; then
    echo "No .env found in main worktree ($main_root)."
    exit 0
fi
cp "$main_root/.env" "$PROJECT_DIR/.env"
echo "Copied .env from main worktree."
echo "Done."
