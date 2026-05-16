#!/usr/bin/env bash

set -euxo pipefail

# Idempotent: safe to re-run (repos, namespaces, kubectl apply, helm upgrade --install).
#
# Default: full local stack — operators, ngrok GatewayClass, then Helm install of
# kairos (helm/values.dev.yaml) so Qdrant, Postgres, Keycloak, MCP app, and Gateway
# routes are applied.
# Optional: KAIROS_NGROK_HOSTNAME=your-subdomain.ngrok-free.dev
# to override gateway hostname / app.keycloakUrl if it differs from values.dev.yaml.
# Operators only (no chart): KAIROS_SKIP_CHART=1 ./helm/.dev/k3b.sh
KAIROS_NAMESPACE="${KAIROS_NAMESPACE:-kairos}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ensure_olm() {
    if kubectl get ns olm >/dev/null 2>&1; then
        return 0
    fi
    if command -v operator-sdk >/dev/null 2>&1; then
        operator-sdk olm install
        return 0
    fi
    echo >&2 "OLM not detected (namespace 'olm' missing) and operator-sdk is not installed."
    echo >&2 "Install OLM first: https://olm.operatorframework.io/docs/getting-started/"
    exit 1
}

k3d cluster list | grep -q '^local-ha-cluster[[:space:]]' || \
    k3d cluster create local-ha-cluster --agents 3 \
      --servers-memory 4g \
      --agents-memory 4g
kubectl config use-context k3d-local-ha-cluster
kubectl create namespace "${KAIROS_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

ensure_olm
"${REPO_ROOT}/helm/prerequisites/install-redis-operator.sh"
"${REPO_ROOT}/helm/prerequisites/install-keycloak-operator.sh" unused "${KAIROS_NAMESPACE}"
"${REPO_ROOT}/helm/prerequisites/install-pg-operator.sh"
"${REPO_ROOT}/helm/prerequisites/install-ngrok-operator.sh"

CHART_DIR="${REPO_ROOT}/helm/kairos-mcp"
VALUES_FILE="${REPO_ROOT}/helm/values.dev.yaml"

if [[ "${KAIROS_SKIP_CHART:-}" == "1" ]]; then
    echo "Skipping kairos Helm chart (KAIROS_SKIP_CHART=1)."
    exit 0
fi

set +x
# Embedding secret (only needed when NOT using Ollama; values.dev.yaml defaults to Ollama)
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    kubectl create secret generic kairos-mcp-embedding -n "${KAIROS_NAMESPACE}" \
        --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
        --dry-run=client -o yaml | kubectl apply -f -
fi

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
