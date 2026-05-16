# helm/.dev — Local Helm workflow

This folder contains a small, idempotent workflow for installing KAIROS MCP on
a single-node local cluster such as Rancher Desktop. It uses localhost URLs and
keeps replicas low to reduce laptop resource usage.

## Quick start

Run the following commands from the repo root:

```bash
./helm/.dev/prepare.sh
./helm/.dev/helm-apply.sh
```

If the embedding secret does not exist, set `OPENAI_API_KEY` before running
`helm-apply.sh`, or create the secret yourself:

```bash
kubectl create secret generic kairos-mcp-embedding -n kairos \
  --from-literal=OPENAI_API_KEY=sk-...
```

## Files

| File | Purpose |
|------|---------|
| `prepare.sh` | Installs operators and ensures Gateway API is enabled |
| `helm-apply.sh` | Installs or upgrades the `kairos` Helm release |
| `values.local.yaml` | Local values: localhost URLs and single replicas |

## Verify

After installation, verify the release:

```bash
kubectl get pods,gateway,httproute -n kairos
curl -sS http://localhost:8000/health
```
