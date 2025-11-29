#!/bin/bash
# Proof of work for: LEARN PROJECT TOOLS
# Discovers available project tools (make or npm)

set -e

if [ -f Makefile ]; then
    echo "Found Makefile, running make..."
    make 2>&1 || true
elif [ -f package.json ]; then
    echo "Found package.json, listing npm scripts..."
    npm run 2>&1 || true
else
    echo "No Makefile or package.json found"
    exit 0
fi

exit 0

