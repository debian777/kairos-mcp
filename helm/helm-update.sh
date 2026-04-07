#!/usr/bin/env bash
# Convenience: helm upgrade kairos using helm/values.dev.yaml (expects deps built + cluster ready).
# Primary install flow: see helm/README.md (operators/infrastructure Kustomize, then helm upgrade).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}/kairos-mcp"
VALUES_FILE="${SCRIPT_DIR}/values.dev.yaml"
KAIROS_NAMESPACE="${KAIROS_NAMESPACE:-kairos}"

helm dependency update "${CHART_DIR}"
helm upgrade --install kairos "${CHART_DIR}" -n "${KAIROS_NAMESPACE}" --create-namespace \
  -f "${VALUES_FILE}" \
  --wait --timeout 15m
