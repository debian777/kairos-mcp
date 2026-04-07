#!/usr/bin/env bash
# Validate helm/operators and helm/infrastructure render with Helm-enabled Kustomize.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v kustomize >/dev/null 2>&1; then
  echo >&2 "kustomize not found; install from https://kubectl.docs.kubernetes.io/installation/kustomize/"
  exit 1
fi

for dir in "${ROOT}/helm/operators" "${ROOT}/helm/infrastructure"; do
  echo "==> kustomize build --enable-helm ${dir}"
  kustomize build --enable-helm "${dir}" >/dev/null
done

echo "OK: both Kustomize trees build."
