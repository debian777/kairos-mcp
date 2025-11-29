#!/bin/bash
# Proof of work for: ATOMICITY (Git Commits)
# Verifies last commit follows conventional commits format

set -e

if ! command -v git >/dev/null 2>&1; then
    echo "Error: git not found" >&2
    exit 1
fi

HANDOFF_LOG="cache/proof/handoff.log"
mkdir -p cache/proof

# Get last commit
LAST_COMMIT=$(git log -1 --pretty="%h %s")

# Check if it follows conventional commits format
if echo "$LAST_COMMIT" | grep -qE '^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\(.+\))?!?:'; then
    echo "$LAST_COMMIT" > "$HANDOFF_LOG"
    echo "✓ Commit follows conventional commits: $LAST_COMMIT"
    exit 0
else
    echo "Error: Last commit does not follow conventional commits format" >&2
    echo "Last commit: $LAST_COMMIT" >&2
    echo "Expected format: <type>(<scope>)?: <description>" >&2
    exit 1
fi

