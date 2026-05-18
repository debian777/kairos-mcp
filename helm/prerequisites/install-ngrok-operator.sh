#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install ngrok Kubernetes Operator with Gateway API support (OLM).
# Usage: ./install-ngrok-operator.sh
#
# Requires NGROK_AUTHTOKEN and NGROK_API_KEY in environment (or yq-readable
# ~/.config/ngrok/ngrok.yml). Creates a GatewayClass named "ngrok".
# renovate: datasource=helm depName=ngrok-operator
NAMESPACE="ngrok-operator"
CREDENTIALS_SECRET="ngrok-k8s-credentials"
NGROK_CONFIG="${NGROK_CONFIG:-$HOME/.config/ngrok/ngrok.yml}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

resolved_authtoken=""
resolved_api_key=""
if command -v yq >/dev/null 2>&1 && [[ -r "$NGROK_CONFIG" ]]; then
    resolved_authtoken="$(yq eval '.agent.authtoken // ""' "$NGROK_CONFIG" | tr -d '\n\r' || true)"
    resolved_api_key="$(yq eval '.agent.api_key // ""' "$NGROK_CONFIG" | tr -d '\n\r' || true)"
fi
[[ -z "$resolved_authtoken" ]] && resolved_authtoken="${NGROK_AUTHTOKEN:-}"
[[ -z "$resolved_api_key" ]] && resolved_api_key="${NGROK_API_KEY:-}"

if [[ -z "$resolved_authtoken" || -z "$resolved_api_key" ]]; then
    echo >&2 "ngrok operator: missing credentials (need authtoken + API key from NGROK_CONFIG or env)"
    exit 1
fi

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic "$CREDENTIALS_SECRET" -n "$NAMESPACE" \
    --from-literal=API_KEY="$resolved_api_key" \
    --from-literal=AUTHTOKEN="$resolved_authtoken" \
    --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -k "${REPO_ROOT}/helm/infrastructure"
kubectl wait --for=condition=Accepted gatewayclass/ngrok --timeout=120s
echo "ngrok bootstrap applied (namespace: ${NAMESPACE})."
