#!/usr/bin/env bash

set -euxo pipefail

# Idempotent: safe to re-run (namespaces, kubectl apply, helm upgrade --install).
#
# Default: full local stack — operators, ngrok GatewayClass, then Helm install of
# kairos (helm/values.dev.yaml) so Qdrant, Postgres, Keycloak, MCP app, and Gateway
# routes are applied.
# Optional: KAIROS_NGROK_HOSTNAME=your-subdomain.ngrok-free.dev
# to override gateway hostname / app.keycloakUrl if it differs from values.dev.yaml.
# Operators only (no chart): KAIROS_SKIP_CHART=1 ./helm/.dev/k3b.sh
KAIROS_NAMESPACE="${KAIROS_NAMESPACE:-kairos}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

k3d cluster list | grep -q '^local-ha-cluster[[:space:]]' || \
    k3d cluster create local-ha-cluster --agents 3 \
      --servers-memory 4g \
      --agents-memory 4g
kubectl config use-context k3d-local-ha-cluster

if ! kubectl get crd subscriptions.operators.coreos.com >/dev/null 2>&1; then
    kubectl apply -f https://github.com/operator-framework/operator-lifecycle-manager/releases/latest/download/crds.yaml
    kubectl apply -f https://github.com/operator-framework/operator-lifecycle-manager/releases/latest/download/olm.yaml
    kubectl wait -n olm --for=condition=Available deployment/olm-operator --timeout=10m
    kubectl wait -n olm --for=condition=Available deployment/catalog-operator --timeout=10m
    kubectl wait -n olm --for=condition=Available deployment/packageserver --timeout=10m
fi

kubectl create namespace "${KAIROS_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -k "${REPO_ROOT}/helm/operators"
kubectl -n operators patch operatorgroup kairos-operators --type=merge -p "{\"spec\":{\"targetNamespaces\":[\"${KAIROS_NAMESPACE}\"]}}" >/dev/null

kubectl wait --for=condition=Established "crd/redisfailovers.databases.spotahome.com" --timeout=10m
kubectl wait --for=condition=Established "crd/keycloaks.k8s.keycloak.org" --timeout=10m
kubectl wait --for=condition=Established "crd/keycloakrealmimports.k8s.keycloak.org" --timeout=10m
kubectl wait --for=condition=Established "crd/perconapgclusters.pgv2.percona.com" --timeout=10m

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

kubectl apply -k "${REPO_ROOT}/helm/infrastructure"
kubectl wait --for=condition=Accepted gatewayclass/ngrok --timeout=120s
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
