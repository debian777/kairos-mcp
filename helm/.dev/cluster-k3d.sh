#!/usr/bin/env bash
# Optional: create/start a local k3d cluster and select its kube context.
# Not required for production; use only for local development.
#
# Env: K3D_CLUSTER_NAME (default: local-ha-cluster)

set -euo pipefail

K3D_CLUSTER_NAME="${K3D_CLUSTER_NAME:-local-ha-cluster}"

if ! command -v k3d >/dev/null 2>&1; then
    echo >&2 "k3d not found; install k3d or use your own cluster context."
    exit 1
fi

k3d cluster list | grep -q "^${K3D_CLUSTER_NAME}[[:space:]]" || \
    k3d cluster create "${K3D_CLUSTER_NAME}" --agents 3 \
      --servers-memory 2g \
      --agents-memory 2g

k3d cluster start "${K3D_CLUSTER_NAME}"
kubectl config use-context "k3d-${K3D_CLUSTER_NAME}"

echo "Cluster ready: ${K3D_CLUSTER_NAME} (context k3d-${K3D_CLUSTER_NAME})"
