#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install Redis Operator via OLM.
# Usage: ./install-redis-operator.sh [RELEASE_NAMESPACE]
TARGET_NAMESPACE="${1:-kairos}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

kubectl apply -f "${REPO_ROOT}/helm/operators/namespace.yaml"
kubectl apply -f "${REPO_ROOT}/helm/operators/operatorgroup.yaml"
kubectl -n operators patch operatorgroup kairos-operators --type=merge -p "{\"spec\":{\"targetNamespaces\":[\"${TARGET_NAMESPACE}\"]}}" >/dev/null
kubectl apply -f "${REPO_ROOT}/helm/operators/subscription-redis-operator.yaml"

kubectl wait --for=condition=Established "crd/redisfailovers.databases.spotahome.com" --timeout=10m
echo "Redis Operator ready (release namespace: ${TARGET_NAMESPACE})."
