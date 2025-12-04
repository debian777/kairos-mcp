#!/bin/bash
# Run each test file individually and capture timing

cd "$(dirname "$0")/.." || exit 1

echo "Running individual test files to measure timing..."
echo ""

for file in tests/integration/*.test.ts; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    echo "=== $filename ==="
    start=$(date +%s.%N)
    npm test -- "$file" 2>&1 | grep -E "(PASS|FAIL|Time:)" | tail -1
    end=$(date +%s.%N)
    elapsed=$(echo "$end - $start" | bc)
    echo "Real time: ${elapsed}s"
    echo ""
  fi
done

