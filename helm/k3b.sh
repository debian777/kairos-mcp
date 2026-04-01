#!/usr/bin/env bash

set -euxo pipefail

# Idempotent: safe to re-run (repos, namespaces, kubectl apply, helm upgrade --install).
#
# Default: full local stack — operators, ngrok GatewayClass, then Helm install of
# kairos (helm/values.dev.yaml) so Qdrant, Postgres, Keycloak, MCP app, and Gateway
# routes are applied. Requires OPENAI_API_KEY in the environment (e.g. source
# .env && ./helm/k3b.sh); the script only creates the K8s Secret from that var.
# Optional: KAIROS_NGROK_HOSTNAME=your-subdomain.ngrok-free.dev
# to override gateway hostname / app.keycloakUrl if it differs from values.dev.yaml.
# Operators only (no chart): KAIROS_SKIP_CHART=1 ./helm/k3b.sh
helm_repo_ensure() {
    local name="$1" url="$2" out ec=0
    out=$(helm repo add "$name" "$url" 2>&1) || ec=$?
    if [[ $ec -eq 0 ]]; then
        [[ -n "$out" ]] && printf '%s\n' "$out"
        return 0
    fi
    if [[ "$out" == *"already exists"* ]] || [[ "$out" == *"Already exists"* ]]; then
        printf '%s\n' "$out"
        return 0
    fi
    printf '%s\n' "$out" >&2
    return "$ec"
}

# Dependency versions
# Do not use redis-operator Helm chart ≥3.3.0: CRDs under crds/ contain Helm templates and fail to install.
# Use ≥3.2.x for policy/v1 PodDisruptionBudget (required on Kubernetes 1.25+; 3.1.x hits "requested resource" errors).
# renovate: datasource=helm registryUrl=https://spotahome.github.io/redis-operator depName=redis-operator
REDIS_OPERATOR_CHART_VERSION=3.2.9
# renovate: datasource=github-tags depName=keycloak/keycloak-k8s-resources
KEYCLOAK_OPERATOR_VERSION=26.5.6
# renovate: datasource=helm registryUrl=https://percona.github.io/percona-helm-charts/ depName=pg-operator
PG_OPERATOR_CHART_VERSION=2.8.2
# renovate: datasource=helm registryUrl=https://charts.ngrok.com depName=ngrok-operator
# Pin empty to use latest from repo; set e.g. 0.23.0 to pin.
NGROK_OPERATOR_CHART_VERSION=""
KAIROS_NAMESPACE="${KAIROS_NAMESPACE:-kairos}"
PG_OPERATOR_NAMESPACE="${PG_OPERATOR_NAMESPACE:-$KAIROS_NAMESPACE}"

k3d cluster list | grep -q '^local-ha-cluster[[:space:]]' || \
    k3d cluster create local-ha-cluster --agents 3 \
      --servers-memory 4g \
      --agents-memory 4g
kubectl config use-context k3d-local-ha-cluster
kubectl create namespace "${KAIROS_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Helm chart repositories
helm_repo_ensure redis-operator https://spotahome.github.io/redis-operator
helm_repo_ensure percona https://percona.github.io/percona-helm-charts/
helm_repo_ensure ngrok https://charts.ngrok.com
helm repo update

# 1. Redis operator (Spotahome)
helm upgrade --install redis-operator redis-operator/redis-operator -n redis-operator --create-namespace --version "${REDIS_OPERATOR_CHART_VERSION}"

# 2. Keycloak operator (new CRDs)
kubectl create namespace keycloak --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloaks.k8s.keycloak.org-v1.yml"
kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloakrealmimports.k8s.keycloak.org-v1.yml"
kubectl -n keycloak apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/kubernetes.yml"
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: keycloak-operator-watch
  namespace: ${KAIROS_NAMESPACE}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: keycloakcontroller-cluster-role
subjects:
  - kind: ServiceAccount
    name: keycloak-operator
    namespace: keycloak
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: keycloak-realmimport-watch
  namespace: ${KAIROS_NAMESPACE}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: keycloakrealmimportcontroller-cluster-role
subjects:
  - kind: ServiceAccount
    name: keycloak-operator
    namespace: keycloak
EOF
kubectl -n keycloak set env deployment/keycloak-operator \
    QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKREALMIMPORTCONTROLLER_NAMESPACES="${KAIROS_NAMESPACE}" \
    QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKCONTROLLER_NAMESPACES="${KAIROS_NAMESPACE}"
kubectl rollout status deployment/keycloak-operator -n keycloak --timeout=120s

# 3. Percona PostgreSQL operator
# Install the operator in the same namespace as the chart-managed PerconaPGCluster.
helm upgrade --install pg-operator percona/pg-operator -n "${PG_OPERATOR_NAMESPACE}" --create-namespace \
    --version "${PG_OPERATOR_CHART_VERSION}"
kubectl rollout status deployment/pg-operator -n "${PG_OPERATOR_NAMESPACE}" --timeout=120s

# 4. ngrok Kubernetes operator (Gateway API)
# Credentials: read from NGROK_CONFIG with yq when yq is available and the file is readable;
# otherwise (or when a value is still empty after yq) use NGROK_AUTHTOKEN and NGROK_API_KEY.
NGROK_OPERATOR_NAMESPACE=ngrok-operator
NGROK_CREDENTIALS_SECRET=ngrok-k8s-credentials
NGROK_CONFIG="${NGROK_CONFIG:-$HOME/.config/ngrok/ngrok.yml}"
# Avoid printing credentials while resolving or creating the secret.
set +x
resolved_authtoken=""
resolved_api_key=""
if command -v yq >/dev/null 2>&1 && [[ -r "$NGROK_CONFIG" ]]; then
    resolved_authtoken="$(yq eval '.agent.authtoken // ""' "$NGROK_CONFIG" | tr -d '\n\r' || true)"
    resolved_api_key="$(yq eval '.agent.api_key // ""' "$NGROK_CONFIG" | tr -d '\n\r' || true)"
fi
[[ -z "$resolved_authtoken" ]] && resolved_authtoken="${NGROK_AUTHTOKEN:-}"
[[ -z "$resolved_api_key" ]] && resolved_api_key="${NGROK_API_KEY:-}"
if [[ -z "$resolved_authtoken" || -z "$resolved_api_key" ]]; then
    echo >&2 "ngrok operator: missing credentials (need authtoken and API key from NGROK_CONFIG or NGROK_AUTHTOKEN / NGROK_API_KEY env vars)"
    exit 1
fi
kubectl create namespace "$NGROK_OPERATOR_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic "$NGROK_CREDENTIALS_SECRET" -n "$NGROK_OPERATOR_NAMESPACE" \
    --from-literal=API_KEY="$resolved_api_key" \
    --from-literal=AUTHTOKEN="$resolved_authtoken" \
    --dry-run=client -o yaml | kubectl apply -f -
set -x
ngrok_helm_version_args=()
[[ -n "${NGROK_OPERATOR_CHART_VERSION}" ]] && ngrok_helm_version_args+=(--version "$NGROK_OPERATOR_CHART_VERSION")
helm upgrade --install ngrok-operator ngrok/ngrok-operator -n "$NGROK_OPERATOR_NAMESPACE" --create-namespace \
    --set credentials.secret.name="$NGROK_CREDENTIALS_SECRET" \
    --set gateway.enabled=true \
    "${ngrok_helm_version_args[@]}"
kubectl rollout status deployment/ngrok-operator-manager -n "$NGROK_OPERATOR_NAMESPACE" --timeout=120s
kubectl rollout status deployment/ngrok-operator-agent -n "$NGROK_OPERATOR_NAMESPACE" --timeout=120s
kubectl apply -f - <<'EOF'
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: ngrok
spec:
  controllerName: ngrok.com/gateway-controller
EOF
kubectl wait --for=condition=Accepted gatewayclass/ngrok --timeout=120s

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${REPO_ROOT}/helm/kairos-mcp"
VALUES_FILE="${REPO_ROOT}/helm/values.dev.yaml"

if [[ "${KAIROS_SKIP_CHART:-}" == "1" ]]; then
    echo "Skipping kairos Helm chart (KAIROS_SKIP_CHART=1)."
    exit 0
fi

set +x
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo >&2 "Full stack needs OPENAI_API_KEY in the environment (MCP embeddings Secret)."
    echo >&2 "Example: set -a && source .env && set +a && $0"
    echo >&2 "Operators + ngrok only: KAIROS_SKIP_CHART=1 $0"
    exit 1
fi

kubectl create secret generic kairos-mcp-embedding -n "${KAIROS_NAMESPACE}" \
    --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
    --dry-run=client -o yaml | kubectl apply -f -

helm_set_args=()
if [[ -n "${KAIROS_NGROK_HOSTNAME:-}" ]]; then
    _ngrok_host="${KAIROS_NGROK_HOSTNAME#https://}"
    _ngrok_host="${_ngrok_host#http://}"
    _ngrok_host="${_ngrok_host%%/*}"
    helm_set_args+=(--set-string "gateway.hostname=${_ngrok_host}")
    helm_set_args+=(--set-string "app.keycloakUrl=https://${_ngrok_host}/sso")
fi

helm dependency update "${CHART_DIR}"
helm upgrade --install kairos "${CHART_DIR}" -n "${KAIROS_NAMESPACE}" --create-namespace \
    -f "${VALUES_FILE}" \
    "${helm_set_args[@]}" \
    --wait --timeout 15m
set -x

echo "kairos Helm release applied. Check: kubectl get pods,gateway,httproute -n ${KAIROS_NAMESPACE}"
