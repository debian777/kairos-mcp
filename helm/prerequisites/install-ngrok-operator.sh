#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install ngrok Kubernetes Operator with Gateway API support.
# Usage: ./install-ngrok-operator.sh [NAMESPACE]
#
# Requires NGROK_AUTHTOKEN and NGROK_API_KEY in environment (or yq-readable
# ~/.config/ngrok/ngrok.yml). Creates a GatewayClass named "ngrok".
# renovate: datasource=helm registryUrl=https://charts.ngrok.com depName=ngrok-operator
CHART_VERSION="${NGROK_OPERATOR_CHART_VERSION:-}"
NAMESPACE="${1:-ngrok-operator}"
CREDENTIALS_SECRET="ngrok-k8s-credentials"
NGROK_CONFIG="${NGROK_CONFIG:-$HOME/.config/ngrok/ngrok.yml}"

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

helm repo add ngrok https://charts.ngrok.com 2>/dev/null || true
helm repo update ngrok

version_args=()
[[ -n "${CHART_VERSION}" ]] && version_args+=(--version "$CHART_VERSION")

helm upgrade --install ngrok-operator ngrok/ngrok-operator -n "$NAMESPACE" --create-namespace \
    --set credentials.secret.name="$CREDENTIALS_SECRET" \
    --set gateway.enabled=true \
    "${version_args[@]}"

kubectl rollout status deployment/ngrok-operator-manager -n "$NAMESPACE" --timeout=120s
kubectl rollout status deployment/ngrok-operator-agent -n "$NAMESPACE" --timeout=120s

kubectl apply -f - <<'EOF'
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: ngrok
spec:
  controllerName: ngrok.com/gateway-controller
EOF
kubectl wait --for=condition=Accepted gatewayclass/ngrok --timeout=120s
echo "ngrok Operator ready in ${NAMESPACE} with GatewayClass/ngrok."
