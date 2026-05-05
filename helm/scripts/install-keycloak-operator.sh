#!/usr/bin/env bash
set -euo pipefail

# Install Keycloak Operator v26.2.4 into a target namespace on a PSA-restricted cluster.
# Usage: ./install-keycloak-operator.sh [CONTEXT] [NAMESPACE]

CONTEXT="${1:-vd-1042-rancl01-ops}"
NAMESPACE="${2:-kairos-mcp}"
VERSION="26.2.4"
BASE_URL="https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${VERSION}/kubernetes"

echo "Installing Keycloak Operator ${VERSION} into ${NAMESPACE} (context: ${CONTEXT})"

# 1. CRDs (cluster-scoped)
kubectl --context "$CONTEXT" apply -f "${BASE_URL}/keycloaks.k8s.keycloak.org-v1.yml"
kubectl --context "$CONTEXT" apply -f "${BASE_URL}/keycloakrealmimports.k8s.keycloak.org-v1.yml"

# 2. Operator deployment (namespace-scoped)
kubectl --context "$CONTEXT" create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl --context "$CONTEXT" apply -f -
kubectl --context "$CONTEXT" -n "$NAMESPACE" apply -f "${BASE_URL}/kubernetes.yml"

# 3. Fix ClusterRoleBinding to point to correct namespace
kubectl --context "$CONTEXT" patch clusterrolebinding keycloak-operator-clusterrole-binding \
  --type='json' -p="[{\"op\": \"replace\", \"path\": \"/subjects/0/namespace\", \"value\":\"${NAMESPACE}\"}]"

# 4. Patch for Pod Security restricted profile
kubectl --context "$CONTEXT" -n "$NAMESPACE" patch deployment keycloak-operator --type=json -p='[
  {"op":"add","path":"/spec/template/spec/securityContext","value":{"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}},
  {"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}}
]'

# 5. Wait for rollout
kubectl --context "$CONTEXT" -n "$NAMESPACE" rollout status deployment/keycloak-operator --timeout=60s

echo "Keycloak Operator ${VERSION} ready in ${NAMESPACE}."
