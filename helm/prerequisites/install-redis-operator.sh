#!/usr/bin/env bash
set -euo pipefail

# Idempotent: install Spotahome Redis Operator via Helm.
# Usage: ./install-redis-operator.sh [NAMESPACE]
#
# Do not use redis-operator Helm chart >=3.3.0: CRDs under crds/ contain Helm
# templates and fail to install. Use >=3.2.x for policy/v1 PodDisruptionBudget.
# renovate: datasource=helm registryUrl=https://spotahome.github.io/redis-operator depName=redis-operator
CHART_VERSION="${REDIS_OPERATOR_CHART_VERSION:-3.2.9}"
NAMESPACE="${1:-redis-operator}"

helm repo add redis-operator https://spotahome.github.io/redis-operator 2>/dev/null || true
helm repo update redis-operator

helm upgrade --install redis-operator redis-operator/redis-operator \
  -n "${NAMESPACE}" --create-namespace \
  --version "${CHART_VERSION}"

kubectl rollout status deployment/redis-operator -n "${NAMESPACE}" --timeout=120s
echo "Redis Operator ${CHART_VERSION} ready in ${NAMESPACE}."
