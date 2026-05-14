#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CHART_DIR="${SCRIPT_DIR}/../kairos-mcp"
NS="${KAIROS_NAMESPACE:-kairos}"
KUBE_CONTEXT="${KUBE_CONTEXT:-rancher-desktop}"
VALUES_FILE="${KAIROS_VALUES_FILE:-${SCRIPT_DIR}/values.local.yaml}"
EMBEDDING_SECRET_NAME="${EMBEDDING_SECRET_NAME:-kairos-mcp-embedding}"

usage() {
  cat <<EOF
Usage: ${0##*/} [OPTIONS] [-- HELM_ARGS...]

Options:
  -c, --context NAME   Kubernetes context (default: rancher-desktop)
  -n, --namespace NS   Target namespace (default: kairos)
  -f, --values FILE    Values file (default: helm/.dev/values.local.yaml)
  -h, --help           Show this help

Environment:
  KAIROS_NAMESPACE            Override namespace (default: kairos)
  KUBE_CONTEXT                Override kube context (default: rancher-desktop)
  KAIROS_VALUES_FILE          Override values file path
  EMBEDDING_SECRET_NAME       Embedding secret name (default: kairos-mcp-embedding)
EOF
  exit 0
}

# ── parse args ───────────────────────────────────────────────────────────────
HELM_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--context) KUBE_CONTEXT="$2"; shift 2 ;;
    -n|--namespace) NS="$2"; shift 2 ;;
    -f|--values)    VALUES_FILE="$2"; shift 2 ;;
    -h|--help)      usage ;;
    --)             shift; HELM_ARGS+=("$@"); break ;;
    *)              HELM_ARGS+=("$1"); shift ;;
  esac
done

if [[ ! -f "$VALUES_FILE" ]]; then
  echo "Error: ${VALUES_FILE} not found" >&2
  exit 1
fi

echo "═══ Context: ${KUBE_CONTEXT}  Namespace: ${NS}  Values: ${VALUES_FILE##*/} ═══"
kubectl config use-context "${KUBE_CONTEXT}" 2>/dev/null || true

kubectl create namespace "${NS}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if ! kubectl get secret "${EMBEDDING_SECRET_NAME}" -n "${NS}" >/dev/null 2>&1; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "Error: ${EMBEDDING_SECRET_NAME} is missing and OPENAI_API_KEY is not set." >&2
    echo "Create the secret or set OPENAI_API_KEY, then re-run:" >&2
    echo "kubectl create secret generic ${EMBEDDING_SECRET_NAME} -n ${NS} --from-literal=OPENAI_API_KEY=<key>" >&2
    exit 1
  fi
  kubectl create secret generic "${EMBEDDING_SECRET_NAME}" -n "${NS}" \
    --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
fi

# ── Helm ───────────────────────────────────────────────────────────────────
helm dependency update "${CHART_DIR}" >/dev/null
helm upgrade --install kairos "${CHART_DIR}" -n "${NS}" --create-namespace \
  -f "${VALUES_FILE}" \
  --wait --timeout 15m \
  "${HELM_ARGS[@]+"${HELM_ARGS[@]}"}"
