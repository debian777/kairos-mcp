#!/usr/bin/env bash
# Helm upgrade kairos release from repo helm/ overlay. Safe to run from any cwd.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}/kairos-mcp"
VALUES_FILE="${SCRIPT_DIR}/values.yaml"
KAIROS_NAMESPACE="${KAIROS_NAMESPACE:-kairos}"

helm dependency update "${CHART_DIR}"
helm upgrade --install kairos "${CHART_DIR}" -n "${KAIROS_NAMESPACE}" --create-namespace \
  -f "${VALUES_FILE}" \
  --wait --timeout 15m
