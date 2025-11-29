#!/bin/bash
# Proof of work for: BASELINE TRUTH (Pre-flight Testing)
# Verifies baseline test log exists

set -e

BASELINE_LOG="cache/tests/baseline.log"

if [ ! -f "$BASELINE_LOG" ]; then
    echo "Warning: Baseline test log not found: $BASELINE_LOG"
    echo "Running tests to establish baseline..."
    
    # Run tests and capture baseline
    mkdir -p cache/tests
    npm run dev:test > "$BASELINE_LOG" 2>&1 || {
        echo "Tests completed (may have failures - documenting baseline)" >> "$BASELINE_LOG"
    }
    
    echo "✓ Baseline established: $BASELINE_LOG"
else
    echo "✓ Baseline log exists: $BASELINE_LOG"
fi

exit 0

