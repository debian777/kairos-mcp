#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install Percona PostgreSQL Operator via Helm.
# Usage: ./install-pg-operator.sh [NAMESPACE]
# renovate: datasource=helm registryUrl=https://percona.github.io/percona-helm-charts/ depName=pg-operator
CHART_VERSION="${PG_OPERATOR_CHART_VERSION:-2.8.2}"
NAMESPACE="${1:-kairos}"

helm repo add percona https://percona.github.io/percona-helm-charts/ 2>/dev/null || true
helm repo update percona

helm upgrade --install pg-operator percona/pg-operator \
  -n "${NAMESPACE}" --create-namespace \
  --version "${CHART_VERSION}"

kubectl rollout status deployment/pg-operator -n "${NAMESPACE}" --timeout=120s
echo "Percona PG Operator ${CHART_VERSION} ready in ${NAMESPACE}."
