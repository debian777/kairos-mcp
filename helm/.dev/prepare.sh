#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NS="${KAIROS_NAMESPACE:-kairos}"
KUBE_CONTEXT="${KUBE_CONTEXT:-rancher-desktop}"
KEYCLOAK_OPERATOR_NAMESPACE="${KEYCLOAK_OPERATOR_NAMESPACE:-keycloak}"

usage() {
  cat <<EOF
Usage: ${0##*/} [OPTIONS]

Options:
  -c, --context NAME   Kubernetes context (default: rancher-desktop)
  -n, --namespace NS   Target namespace (default: kairos)
  -h, --help           Show this help

Environment:
  KAIROS_NAMESPACE            Override namespace (default: kairos)
  KUBE_CONTEXT                Override kube context (default: rancher-desktop)
  KEYCLOAK_OPERATOR_NAMESPACE Namespace for Keycloak operator deployment (default: keycloak)
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--context) KUBE_CONTEXT="$2"; shift 2 ;;
    -n|--namespace) NS="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

kubectl config use-context "${KUBE_CONTEXT}" >/dev/null 2>&1 || true

kubectl create namespace "${NS}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if ! kubectl get helmchartconfig traefik -n kube-system >/dev/null 2>&1; then
  kubectl apply -f - <<'EOF' >/dev/null
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    experimental:
      kubernetesGateway:
        enabled: true
EOF
  kubectl rollout status deployment/traefik -n kube-system --timeout=120s
fi

if ! kubectl get gatewayclass kairos >/dev/null 2>&1; then
  kubectl apply -f - <<'EOF' >/dev/null
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: kairos
spec:
  controllerName: traefik.io/gateway-controller
EOF
  kubectl wait --for=condition=Accepted gatewayclass/kairos --timeout=120s >/dev/null
fi

"${REPO_ROOT}/helm/prerequisites/install-pg-operator.sh" "${NS}"
"${REPO_ROOT}/helm/prerequisites/install-keycloak-operator.sh" "${KEYCLOAK_OPERATOR_NAMESPACE}" "${NS}"
