# Operators (Kustomize)

Installs **Redis (Spotahome)**, **Keycloak operator**, and **Percona PostgreSQL operator** for clusters where the `helm/kairos-mcp` chart creates `RedisFailover`, `Keycloak`, and `PerconaPGCluster` CRs.

## Prerequisites

- `kubectl`, `helm`, and **Kustomize ≥ 4.5** with Helm support (`kustomize build --enable-helm`).
- Apply **before** installing the `kairos-mcp` Helm release when those CRs are enabled in values.

## Apply

From repository root:

```bash
kubectl apply -k helm/operators
```

Or build and review:

```bash
kustomize build --enable-helm helm/operators | kubectl apply -f -
```

## Pin versions

Chart and Keycloak versions are pinned in:

- `kustomization.yaml` (`helmCharts` entries)
- `keycloak/kustomization.yaml` (upstream YAML URLs — tag **26.5.6**)

To use a different **application namespace** than `kairos`, replace `kairos` in `keycloak-rbac.yaml` and `keycloak/watch-kairos-namespace.yaml`, or add a Kustomize overlay.

## Rollout

After apply, wait for operator deployments (same as legacy bootstrap):

```bash
kubectl rollout status deployment/keycloak-operator -n keycloak --timeout=120s
kubectl rollout status deployment/pg-operator -n kairos --timeout=120s
```

(`redis-operator` chart creates its own workload in `redis-operator`.)
