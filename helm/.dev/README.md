# helm/.dev — Local Development Profiles

Progressive chart testing on a local Kubernetes cluster (k3s, k3d, Rancher Desktop).

## Profiles

| Profile | Command | What you get |
|---------|---------|-------------|
| default | `./helm/.dev/helm-deploy.sh` | Core baseline: app + Qdrant only |
| http | `./helm/.dev/helm-deploy.sh --profile http` | Core + HTTP Gateway/Ingress |
| tls | `./helm/.dev/helm-deploy.sh --profile tls` | HTTP stage alias (TLS disabled in `.dev`) |
| tls-redis | `./helm/.dev/helm-deploy.sh --profile tls-redis` | HTTP + Valkey |
| full | `./helm/.dev/helm-deploy.sh --profile full` | HTTP + Valkey + Postgres + Keycloak |

Add more by creating `values-<name>.yaml`. Dependencies auto-install based on profile name.

## Quick start

```bash
# 1) Start from minimal core baseline (default profile)
./helm/.dev/helm-deploy.sh

# 2) Add HTTP routing
./helm/.dev/helm-deploy.sh --profile http

# 3) "tls" stage (currently HTTP only)
./helm/.dev/helm-deploy.sh --profile tls

# 4) Add Valkey
./helm/.dev/helm-deploy.sh --profile tls-redis

# 5) Add operator-backed Keycloak + Postgres
./helm/.dev/helm-deploy.sh --profile full
```

Verify: `curl http://localhost/health`

Pass extra helm flags after `--`: `./helm/.dev/helm-deploy.sh --profile http -- --dry-run`

## Files

| File | Purpose |
|------|---------|
| `helm-deploy.sh` | Install deps + deploy (single entry point) |
| `values.yaml` | Stage 1: core baseline (no gateway, no Valkey) |
| `values-http.yaml` | Stage 2: add HTTP routing |
| `values-tls.yaml` | Stage 3 alias (HTTP in `.dev`, TLS settings commented) |
| `values-tls-redis.yaml` | Stage 4: add Valkey (HTTP in `.dev`) |
| `values-full.yaml` | Stage 5: add Postgres + Keycloak |
| `cluster-k3d.sh` | Spin up a k3d cluster (optional) |
| `cluster-k3s-lima.sh` | Spin up k3s on Lima VMs (optional) |

TLS in `.dev` is currently disabled to reduce local setup friction.
