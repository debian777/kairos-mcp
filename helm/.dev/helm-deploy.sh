#!/usr/bin/env bash
# helm/.dev/helm-deploy.sh — Single entry point for local chart dev testing.
# Installs dependencies, sets up infra, deploys chart with staged values.
#
# Usage:
#   ./helm/.dev/helm-deploy.sh                      # default profile
#   ./helm/.dev/helm-deploy.sh --profile tls        # HTTPS via cert-manager
#   ./helm/.dev/helm-deploy.sh --profile tls-redis  # HTTPS + Valkey
#   ./helm/.dev/helm-deploy.sh --profile full       # Full stack (KC + PG + Ollama)
#   ./helm/.dev/helm-deploy.sh --profile tls -- --wait
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/../.."
CHART_DIR="${SCRIPT_DIR}/../kairos-mcp"
NS="${KAIROS_NAMESPACE:-kairos}"
KUBE_CONTEXT="${KUBE_CONTEXT:-rancher-desktop}"

install_operators_olm() {
  if ! kubectl get ns olm >/dev/null 2>&1; then
    echo "Error: OLM not detected (namespace 'olm' missing). Install OLM first: https://olm.operatorframework.io/docs/getting-started/" >&2
    exit 1
  fi
  kubectl apply -k "${REPO_ROOT}/helm/operators" >/dev/null
  kubectl wait --for=condition=Established crd/keycloaks.k8s.keycloak.org --timeout=300s >/dev/null
  kubectl wait --for=condition=Established crd/perconapgclusters.pgv2.percona.com --timeout=300s >/dev/null
}

usage() {
  cat <<EOF
Usage: ${0##*/} [OPTIONS] [-- HELM_ARGS...]

Options:
  -p, --profile NAME   Profile to deploy (default, tls, tls-redis, full, ...)
  -c, --context NAME   Kubernetes context (default: rancher-desktop)
  -n, --namespace NS   Target namespace (default: kairos)
      --skip-infra     Skip infrastructure/operator setup
  -h, --help           Show this help

Environment:
  KAIROS_NAMESPACE            Override namespace (default: kairos)
  KUBE_CONTEXT                Override kube context (default: rancher-desktop)
EOF
  exit 0
}

infer_profile_from_release() {
  if ! helm status kairos -n "${NS}" >/dev/null 2>&1; then
    echo ""
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo ""
    return 0
  fi
  local vals
  vals="$(helm get values kairos -n "${NS}" -a -o json 2>/dev/null || echo '{}')"

  local gw_enabled tls_cm valkey_enabled kc_enabled pg_enabled realm_enabled ollama_enabled
  gw_enabled="$(jq -r '.gateway.enabled // false' <<<"${vals}")"
  tls_cm="$(jq -r '.gateway.tls.certManager.enabled // false' <<<"${vals}")"
  valkey_enabled="$(jq -r '.valkey.enabled // false' <<<"${vals}")"
  kc_enabled="$(jq -r '.keycloakInstance.enabled // false' <<<"${vals}")"
  pg_enabled="$(jq -r '.postgresCluster.enabled // false' <<<"${vals}")"
  realm_enabled="$(jq -r '.keycloakRealmImport.enabled // false' <<<"${vals}")"
  ollama_enabled="$(jq -r '.ollama.enabled // false' <<<"${vals}")"

  if [[ "${kc_enabled}" == "true" && "${pg_enabled}" == "true" && "${realm_enabled}" == "true" ]]; then
    echo "full"
  elif [[ "${tls_cm}" == "true" && "${valkey_enabled}" == "true" ]]; then
    echo "tls-redis"
  elif [[ "${tls_cm}" == "true" ]]; then
    echo "tls"
  elif [[ "${gw_enabled}" == "true" ]]; then
    echo "http"
  else
    echo "default"
  fi
}

# ── parse args ───────────────────────────────────────────────────────────────
PROFILE=""
SKIP_INFRA=false
HELM_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--profile) PROFILE="$2"; shift 2 ;;
    -c|--context) KUBE_CONTEXT="$2"; shift 2 ;;
    -n|--namespace) NS="$2"; shift 2 ;;
    --skip-infra)   SKIP_INFRA=true; shift ;;
    -h|--help)      usage ;;
    --)             shift; HELM_ARGS+=("$@"); break ;;
    *)              HELM_ARGS+=("$1"); shift ;;
  esac
done

if [[ -z "$PROFILE" ]]; then
  INFERRED_PROFILE="$(infer_profile_from_release)"
  if [[ -n "${INFERRED_PROFILE}" && "${INFERRED_PROFILE}" != "default" && -f "${SCRIPT_DIR}/values-${INFERRED_PROFILE}.yaml" ]]; then
    PROFILE="${INFERRED_PROFILE}"
    VALUES_FILE="${SCRIPT_DIR}/values-${PROFILE}.yaml"
    echo "▸ Auto-selected profile from current Helm release: ${PROFILE}"
  else
    VALUES_FILE="${SCRIPT_DIR}/values.yaml"
  fi
else
  VALUES_FILE="${SCRIPT_DIR}/values-${PROFILE}.yaml"
fi

if [[ ! -f "$VALUES_FILE" ]]; then
  echo "Error: ${VALUES_FILE} not found" >&2
  echo "Available profiles:" >&2
  for f in "${SCRIPT_DIR}"/values*.yaml; do
    echo "  ${f##*/values}" | sed 's/^  -/  /;s/\.yaml$//' >&2
  done
  exit 1
fi

echo "═══ Profile: ${PROFILE:-default}  Context: ${KUBE_CONTEXT}  Namespace: ${NS} ═══"
echo ""
kubectl config use-context "${KUBE_CONTEXT}" 2>/dev/null || true

if [[ "${SKIP_INFRA}" == "true" ]]; then
  echo "▸ Skipping infrastructure setup (--skip-infra)"
else

# ── Traefik Gateway API ───────────────────────────────────────────────────
echo "▸ Traefik GatewayClass"
if [[ -d "${REPO_ROOT}/argocd/infrastructure/overlays/traefik" ]]; then
  kubectl apply -k "${REPO_ROOT}/argocd/infrastructure/overlays/traefik" 2>&1 | rg -v unchanged || true
else
  echo "  argocd/infrastructure/overlays/traefik not found, using local Traefik config fallback."
fi
if ! kubectl get helmchartconfig traefik -n kube-system &>/dev/null; then
  kubectl apply -f - <<'EOF'
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
    ports:
      websecure:
        port: 8443
        protocol: HTTPS
EOF
  sleep 5
  kubectl rollout status deployment/traefik -n kube-system --timeout=60s
fi

# ── Operators (profiles containing "full") ─────────────────────────────
if [[ "$PROFILE" == *full* ]]; then
  echo "▸ Operators (Keycloak, Postgres)"
  if [[ -d "${REPO_ROOT}/argocd/operators" ]] && kubectl apply -k "${REPO_ROOT}/argocd/operators" >/dev/null 2>&1; then
    echo "  Applied argocd/operators kustomization."
  else
    echo "  argocd/operators unavailable or broken, using helm/operators OLM bootstrap."
    install_operators_olm
  fi
fi

fi # end SKIP_INFRA

# ── Secrets ────────────────────────────────────────────────────────────────
echo "▸ Secrets"
kubectl create namespace "${NS}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

# Embedding secret (not needed when using Ollama)
if helm get values kairos -n "${NS}" -o json 2>/dev/null | jq -e '.ollama.enabled == true' >/dev/null 2>&1; then
  echo "  Ollama enabled — skipping OpenAI embedding secret."
elif ! kubectl get secret kairos-mcp-embedding -n "${NS}" &>/dev/null; then
  if [[ -x "${REPO_ROOT}/argocd/secrets/setup-secrets.sh" ]]; then
    "${REPO_ROOT}/argocd/secrets/setup-secrets.sh"
  else
    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
      echo "Error: kairos-mcp-embedding is missing and OPENAI_API_KEY is not set." >&2
      echo "Set OPENAI_API_KEY or create secret manually:" >&2
      echo "kubectl create secret generic kairos-mcp-embedding -n ${NS} --from-literal=OPENAI_API_KEY=<key>" >&2
      exit 1
    fi
    kubectl create secret generic kairos-mcp-embedding -n "${NS}" \
      --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY}" \
      --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    echo "  Created/updated kairos-mcp-embedding from OPENAI_API_KEY."
  fi
else
  echo "  Already provisioned. Run argocd/secrets/setup-secrets.sh --update to change."
fi

# ── Helm ───────────────────────────────────────────────────────────────────
echo ""
echo "▸ Helm upgrade (${VALUES_FILE##*/})"
helm dependency update "${CHART_DIR}" 2>&1 | tail -1
helm upgrade --install kairos "${CHART_DIR}" -n "${NS}" --create-namespace \
  -f "${VALUES_FILE}" \
  "${HELM_ARGS[@]+"${HELM_ARGS[@]}"}"
