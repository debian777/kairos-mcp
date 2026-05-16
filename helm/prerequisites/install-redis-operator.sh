#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
kubectl apply -k "${SCRIPT_DIR}/../operators"
kubectl wait --for=condition=Established crd/redisfailovers.databases.spotahome.com --timeout=300s
echo "Redis Operator subscription applied (namespace: kairos-operators)."
