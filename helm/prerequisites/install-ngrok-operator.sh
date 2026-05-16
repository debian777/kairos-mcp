#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-kairos-operators}"
CREDENTIALS_SECRET="ngrok-operator-credentials"
NGROK_CONFIG="${NGROK_CONFIG:-$HOME/.config/ngrok/ngrok.yml}"

if [[ "${NAMESPACE}" != "kairos-operators" ]]; then
    echo >&2 "ngrok operator install: this repo installs ngrok via OLM into namespace 'kairos-operators' (got '${NAMESPACE}')."
    exit 1
fi

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
kubectl apply -k "${SCRIPT_DIR}/../infrastructure"

kubectl create secret generic "$CREDENTIALS_SECRET" -n "$NAMESPACE" \
    --from-literal=API_KEY="$resolved_api_key" \
    --from-literal=AUTHTOKEN="$resolved_authtoken" \
    --dry-run=client -o yaml | kubectl apply -f -

kubectl wait --for=condition=Accepted gatewayclass/ngrok --timeout=120s
echo "ngrok Operator subscription applied (namespace: kairos-operators) and GatewayClass/ngrok ensured."
