#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install Percona PostgreSQL Operator via OLM.
# Usage: ./install-pg-operator.sh [RELEASE_NAMESPACE]
TARGET_NAMESPACE="${1:-kairos}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

kubectl apply -f "${REPO_ROOT}/helm/operators/namespace.yaml"
kubectl apply -f "${REPO_ROOT}/helm/operators/operatorgroup.yaml"
kubectl -n operators patch operatorgroup kairos-operators --type=merge -p "{\"spec\":{\"targetNamespaces\":[\"${TARGET_NAMESPACE}\"]}}" >/dev/null
kubectl apply -f "${REPO_ROOT}/helm/operators/subscription-percona-postgresql-operator.yaml"

kubectl wait --for=condition=Established "crd/perconapgclusters.pgv2.percona.com" --timeout=10m
echo "Percona PostgreSQL Operator ready (release namespace: ${TARGET_NAMESPACE})."
