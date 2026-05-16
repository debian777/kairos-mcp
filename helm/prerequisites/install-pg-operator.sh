#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
kubectl apply -k "${SCRIPT_DIR}/../operators"
kubectl wait --for=condition=Established crd/perconapgclusters.pgv2.percona.com --timeout=300s
echo "Percona PostgreSQL Operator subscription applied (namespace: kairos-operators)."
