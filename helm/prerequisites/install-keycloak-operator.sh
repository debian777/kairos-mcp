#!/usr/bin/env bash
set -euo pipefail

WATCH_NAMESPACE="${2:-kairos}"
if [[ "${WATCH_NAMESPACE}" != "kairos" ]]; then
  echo >&2 "Keycloak operator install: this repo's OLM manifests target namespace 'kairos' (got '${WATCH_NAMESPACE}')."
  echo >&2 "Update helm/operators/operators.yaml OperatorGroup.spec.targetNamespaces to change the watched namespace."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
kubectl apply -k "${SCRIPT_DIR}/../operators"
kubectl wait --for=condition=Established crd/keycloaks.k8s.keycloak.org --timeout=300s
kubectl wait --for=condition=Established crd/keycloakrealmimports.k8s.keycloak.org --timeout=300s
echo "Keycloak Operator subscription applied (namespace: kairos-operators)."
