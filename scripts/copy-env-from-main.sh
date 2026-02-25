#!/usr/bin/env bash
# Copy .env* files from the main git worktree into the current workspace.
# Use when working in a worktree that doesn't have its own .env files.
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

count=0
for f in "$main_root"/.env*; do
    [ -e "$f" ] || continue
    [ -f "$f" ] || continue
    name="${f##*/}"
    cp "$f" "$PROJECT_DIR/$name"
    echo "Copied $name from main worktree"
    count=$((count + 1))
done

if [ "$count" -eq 0 ]; then
    echo "No .env* files found in main worktree ($main_root)."
    exit 0
fi

echo "Done. Copied $count file(s) to $PROJECT_DIR"
