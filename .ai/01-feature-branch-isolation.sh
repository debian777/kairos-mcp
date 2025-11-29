#!/bin/bash
# Proof of work for: FEATURE BRANCH ISOLATION
# Verifies we're on a feature branch (not main)

set -e

if ! command -v git >/dev/null 2>&1; then
    echo "Error: git not found" >&2
    exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "main" ]; then
    echo "Error: Working on main branch. Create a feature branch first." >&2
    exit 1
fi

echo "✓ On feature branch: $BRANCH"
exit 0

