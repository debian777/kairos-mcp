#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install Keycloak Operator via OLM.
# Usage: ./install-keycloak-operator.sh [RELEASE_NAMESPACE]
TARGET_NAMESPACE="${1:-kairos}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

kubectl apply -f "${REPO_ROOT}/helm/operators/namespace.yaml"
kubectl apply -f "${REPO_ROOT}/helm/operators/operatorgroup.yaml"
kubectl -n operators patch operatorgroup kairos-operators --type=merge -p "{\"spec\":{\"targetNamespaces\":[\"${TARGET_NAMESPACE}\"]}}" >/dev/null
kubectl apply -f "${REPO_ROOT}/helm/operators/subscription-keycloak-operator.yaml"

kubectl wait --for=condition=Established "crd/keycloaks.k8s.keycloak.org" --timeout=10m
kubectl wait --for=condition=Established "crd/keycloakrealmimports.k8s.keycloak.org" --timeout=10m
echo "Keycloak Operator ready (release namespace: ${TARGET_NAMESPACE})."
