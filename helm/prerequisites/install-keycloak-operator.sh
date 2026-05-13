#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install Keycloak Operator CRDs and deployment.
# Usage: ./install-keycloak-operator.sh [OPERATOR_NAMESPACE] [WATCH_NAMESPACE]
#
# OPERATOR_NAMESPACE: where the operator deployment lives (default: keycloak).
# WATCH_NAMESPACE: namespace the operator watches for Keycloak CRs (default: kairos).
# On PSA-restricted clusters, applies security context patches.
# renovate: datasource=github-tags depName=keycloak/keycloak-k8s-resources
VERSION="${KEYCLOAK_OPERATOR_VERSION:-26.5.6}"
OPERATOR_NAMESPACE="${1:-keycloak}"
WATCH_NAMESPACE="${2:-kairos}"
BASE_URL="https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${VERSION}/kubernetes"

echo "Installing Keycloak Operator ${VERSION} (ns: ${OPERATOR_NAMESPACE}, watching: ${WATCH_NAMESPACE})"

# 1. CRDs (cluster-scoped)
kubectl apply -f "${BASE_URL}/keycloaks.k8s.keycloak.org-v1.yml"
kubectl apply -f "${BASE_URL}/keycloakrealmimports.k8s.keycloak.org-v1.yml"

# 2. Operator deployment
kubectl create namespace "$OPERATOR_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$OPERATOR_NAMESPACE" apply -f "${BASE_URL}/kubernetes.yml"

# 3. Cross-namespace RBAC so the operator can reconcile in WATCH_NAMESPACE
kubectl create namespace "$WATCH_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: keycloak-operator-watch
  namespace: ${WATCH_NAMESPACE}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: keycloakcontroller-cluster-role
subjects:
  - kind: ServiceAccount
    name: keycloak-operator
    namespace: ${OPERATOR_NAMESPACE}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: keycloak-realmimport-watch
  namespace: ${WATCH_NAMESPACE}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: keycloakrealmimportcontroller-cluster-role
subjects:
  - kind: ServiceAccount
    name: keycloak-operator
    namespace: ${OPERATOR_NAMESPACE}
EOF

# 4. Configure operator to watch the target namespace
kubectl -n "$OPERATOR_NAMESPACE" set env deployment/keycloak-operator \
    QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKREALMIMPORTCONTROLLER_NAMESPACES="${WATCH_NAMESPACE}" \
    QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKCONTROLLER_NAMESPACES="${WATCH_NAMESPACE}"

# 5. PSA hardening (safe to re-apply)
kubectl -n "$OPERATOR_NAMESPACE" patch deployment keycloak-operator --type=json -p='[
  {"op":"add","path":"/spec/template/spec/securityContext","value":{"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}},
  {"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}}
]' 2>/dev/null || true

# 6. Wait for rollout
kubectl -n "$OPERATOR_NAMESPACE" rollout status deployment/keycloak-operator --timeout=120s
echo "Keycloak Operator ${VERSION} ready in ${OPERATOR_NAMESPACE} (watching ${WATCH_NAMESPACE})."
