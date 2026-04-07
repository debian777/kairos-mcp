# Helm layout

## Application chart

- **`kairos-mcp/`** — Helm chart for the MCP app and **bundled Qdrant** (subchart). Default install is **app + Qdrant** with minimal values; optional Redis, Keycloak, Postgres, and Gateway API are off until you enable them in values.
- **Example overlays:** `values.dev.yaml`, `values.prod.yaml` (full-stack examples with operators + gateway).

## Cluster prerequisites (Kustomize)

When you enable chart-managed **Redis**, **Keycloak**, or **Postgres** CRs, install operators **first**:

| Step | Path | Purpose |
|------|------|---------|
| 1 | [`operators/`](operators/) | Redis (Spotahome), Keycloak operator, Percona PG operator |
| 2 | [`infrastructure/`](infrastructure/) | ngrok Kubernetes operator + `GatewayClass/ngrok` (for public Gateway API ingress) |

From repository root:

```bash
kubectl apply -k helm/operators
# After rollouts (see operators/README.md):
# Create ngrok Secret per infrastructure/README.md, then:
kubectl apply -k helm/infrastructure
```

Build locally (requires `kustomize build --enable-helm`):

```bash
./scripts/validate-kustomize.sh
```

## Install the chart

```bash
helm repo add qdrant https://qdrant.github.io/qdrant-helm   # once, for dependency resolution
helm dependency build helm/kairos-mcp
kubectl create namespace kairos --dry-run=client -o yaml | kubectl apply -f -
# Embedding Secret (default name kairos-mcp-embedding — see chart values):
kubectl create secret generic kairos-mcp-embedding -n kairos \
  --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install kairos helm/kairos-mcp -n kairos --create-namespace
```

Use `-f helm/values.dev.yaml` (or your own values) for a full local or production profile.

## Maintainer scripts

- **[`helm/helm-update.sh`](helm-update.sh)** — convenience `helm upgrade` using `values.dev.yaml` (expects dependencies built and cluster already configured).
- **[`../scripts/test-helm.sh`](../scripts/test-helm.sh)** — `helm lint`, unittest, chart-testing, kubeconform, and Kustomize validation when `kustomize` is installed.

## Local k3d only

See **[`.dev/README.md`](.dev/README.md)** and optional **[`.dev/cluster-k3d.sh`](.dev/cluster-k3d.sh)**.
