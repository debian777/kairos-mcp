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
KEYCLOAK_OPERATOR_VERSION="${KEYCLOAK_OPERATOR_VERSION:-26.5.6}"
PERCONA_PG_OPERATOR_VERSION="${PERCONA_PG_OPERATOR_VERSION:-2.8.2}"

install_keycloak_operator() {
  local target_ns="${1:-${NS}}"
  echo "  Installing Keycloak operator into namespace: ${target_ns}"
  kubectl create namespace "${target_ns}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloaks.k8s.keycloak.org-v1.yml" >/dev/null
  kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloakrealmimports.k8s.keycloak.org-v1.yml" >/dev/null
  kubectl -n "${target_ns}" apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/kubernetes.yml" >/dev/null

  # Patch for restricted PSA
  kubectl -n "${target_ns}" patch deployment keycloak-operator --type=json -p='[
    {"op":"add","path":"/spec/template/spec/containers/0/securityContext","value":{
      "runAsNonRoot":true,"allowPrivilegeEscalation":false,
      "capabilities":{"drop":["ALL"]},"seccompProfile":{"type":"RuntimeDefault"}
    }},
    {"op":"add","path":"/spec/template/spec/securityContext","value":{
      "runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}
    }}
  ]' 2>/dev/null || true

  # Scope operator to target namespace
  kubectl -n "${target_ns}" set env deployment/keycloak-operator \
    QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKREALMIMPORTCONTROLLER_NAMESPACES="${target_ns}" \
    QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKCONTROLLER_NAMESPACES="${target_ns}" >/dev/null
  kubectl rollout status deployment/keycloak-operator -n "${target_ns}" --timeout=120s
}

install_percona_pg_operator() {
  echo "  Installing Percona PostgreSQL operator"
  helm repo add percona https://percona.github.io/percona-helm-charts/ >/dev/null 2>&1 || true
  helm repo update >/dev/null
  helm upgrade --install pg-operator percona/pg-operator \
    -n "${NS}" \
    --create-namespace \
    --version "${PERCONA_PG_OPERATOR_VERSION}" \
    --skip-crds >/dev/null
  kubectl rollout status deployment/pg-operator -n "${NS}" --timeout=120s
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
  KEYCLOAK_OPERATOR_VERSION   Keycloak operator version (default: 26.5.6)
  PERCONA_PG_OPERATOR_VERSION Percona PG operator version (default: 2.8.2)
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
    echo "  argocd/operators unavailable or broken, using helm/.dev fallback installer."
    if ! kubectl get crd keycloaks.k8s.keycloak.org >/dev/null 2>&1 || ! kubectl -n "${NS}" get deployment keycloak-operator >/dev/null 2>&1; then
      install_keycloak_operator "${NS}"
    else
      echo "  Keycloak operator already installed."
    fi
    if ! kubectl get crd perconapgclusters.pgv2.percona.com >/dev/null 2>&1 || ! kubectl -n "${NS}" get deployment pg-operator >/dev/null 2>&1; then
      install_percona_pg_operator
    else
      echo "  Percona PG operator already installed."
    fi
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

# SMTP secret for Keycloak (optional)
if [[ -n "${KAIROS_SMTP_HOST:-}" ]] && ! kubectl get secret keycloak-smtp -n "${NS}" &>/dev/null; then
  kubectl create secret generic keycloak-smtp -n "${NS}" \
    --from-literal=host="${KAIROS_SMTP_HOST}" \
    --from-literal=port="${KAIROS_SMTP_PORT:-587}" \
    --from-literal=from="${KAIROS_SMTP_FROM:-kairos@bsdigital.com}" \
    --from-literal=user="${KAIROS_SMTP_USER:-}" \
    --from-literal=password="${KAIROS_SMTP_PASSWORD:-}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  echo "  Created keycloak-smtp secret."
fi

# ── Helm ───────────────────────────────────────────────────────────────────
echo ""
echo "▸ Helm upgrade (${VALUES_FILE##*/})"
helm dependency update "${CHART_DIR}" 2>&1 | tail -1
helm upgrade --install kairos "${CHART_DIR}" -n "${NS}" --create-namespace \
  -f "${VALUES_FILE}" \
  "${HELM_ARGS[@]+"${HELM_ARGS[@]}"}"
