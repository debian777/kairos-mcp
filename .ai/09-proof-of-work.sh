#!/bin/bash
# Proof of work for: PROOF OF WORK (The Handoff)
# Verifies working tree is clean and commit is in handoff log

set -e

if ! command -v git >/dev/null 2>&1; then
    echo "Error: git not found" >&2
    exit 1
fi

HANDOFF_LOG="cache/proof/handoff.log"

# Check if working tree is clean
if ! git diff-index --quiet HEAD --; then
    echo "Error: Working tree has uncommitted changes" >&2
    exit 1
fi

# Get short commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)

# Check if commit is in handoff log
if [ -f "$HANDOFF_LOG" ] && grep -q "^$COMMIT_HASH" "$HANDOFF_LOG"; then
    echo "✓ Working tree is clean"
    echo "✓ Commit $COMMIT_HASH is in handoff log"
    exit 0
else
    echo "Error: Commit $COMMIT_HASH not found in handoff log: $HANDOFF_LOG" >&2
    exit 1
fi

