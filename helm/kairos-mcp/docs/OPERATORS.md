# Step-by-step operator installation (OLM)

Install these operators before you install the KAIROS MCP chart when you use chart-created clusters.

## 0. Install OLM

Follow the official guide: https://olm.operatorframework.io/docs/getting-started/

## 1. Apply this repo’s operator bootstrap manifests

This repo installs operators into the `kairos-operators` namespace and scopes them to watch `kairos` via an `OperatorGroup`.

```bash
kubectl apply -k helm/operators
kubectl apply -k helm/infrastructure
```

## 2. Verify operator installation

```bash
kubectl get operatorgroup,subscription,installplan,csv -n kairos-operators
kubectl get catalogsource -n olm
```

Required CRDs for the Helm chart:

- RedisFailover: `redisfailovers.databases.spotahome.com`
- Keycloak: `keycloaks.k8s.keycloak.org`
- Percona PostgreSQL: `perconapgclusters.pgv2.percona.com`

## Notes

### Keycloak operator

This repo subscribes to `keycloak-operator` on the `fast` channel.

### Percona PostgreSQL operator

This repo subscribes to `percona-postgresql-operator` on the `stable` channel.

### Redis operator (Spotahome) and ngrok operator

These are installed via a custom `CatalogSource` named `kairos-catalog` (in `olm`).

If your cluster cannot pull `ghcr.io/debian777/kairos-olm-catalog:latest`, update the `CatalogSource.spec.image` in:

- `helm/operators/operators.yaml`
- `helm/infrastructure/infrastructure.yaml`

### ngrok credentials

Create the ngrok credentials secret in `kairos-operators`:

```bash
./helm/prerequisites/install-ngrok-operator.sh
```
