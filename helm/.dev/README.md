# Local development (optional)

This directory is **not** part of the supported install path for production clusters. Use it only when you want a **local k3d** profile.

## Typical local flow

1. **Cluster (optional):** `./helm/.dev/cluster-k3d.sh`
2. **Operators:** `kubectl apply -k helm/operators` (wait for rollouts; see [helm/operators/README.md](../operators/README.md))
3. **Infrastructure (ngrok):** create the ngrok Secret per [helm/infrastructure/README.md](../infrastructure/README.md), then `kubectl apply -k helm/infrastructure`
4. **Embedding Secret:** create a Secret for OpenAI (or use TEI via chart values), e.g.  
   `kubectl create secret generic kairos-mcp-embedding -n kairos --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" --dry-run=client -o yaml | kubectl apply -f -`
5. **Chart:** from repo root, `helm dependency update helm/kairos-mcp` then  
   `helm upgrade --install kairos helm/kairos-mcp -n kairos --create-namespace -f helm/values.dev.yaml`

Use **`helm/values.dev.yaml`** for image tags, gateway hostname, and feature flags appropriate to your machine.

## Environment variables

| Variable | Used for |
|----------|----------|
| `OPENAI_API_KEY` | Embedding Secret (step 4) |
| `NGROK_API_KEY`, `NGROK_AUTHTOKEN` | ngrok operator Secret (see infrastructure README) |
| `K3D_CLUSTER_NAME` | Override k3d cluster name (default `local-ha-cluster`) |
