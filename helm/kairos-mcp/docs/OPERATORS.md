# Step-by-step operator installation (OLM)

Install these operators before you install the KAIROS MCP chart when you enable any chart-created clusters (RedisFailover, Keycloak, PerconaPGCluster).

## 0. Install OLM

Install OLM on your cluster following the official guide:

https://olm.operatorframework.io/docs/getting-started/

## 1. Install operators (Subscriptions)

```bash
kubectl apply -k helm/operators
```

If you install the KAIROS chart into a namespace other than `kairos`, update `helm/operators/operatorgroup.yaml` so `spec.targetNamespaces` includes your release namespace.

## 2. Install infrastructure (ngrok)

```bash
kubectl apply -k helm/infrastructure
```

Do not commit ngrok credentials to git. Create them at runtime:

```bash
kubectl create secret generic ngrok-k8s-credentials -n ngrok-operator \
  --from-literal=API_KEY="$NGROK_API_KEY" \
  --from-literal=AUTHTOKEN="$NGROK_AUTHTOKEN"
```

## 3. Verify required CRDs

```bash
kubectl get crd redisfailovers.databases.spotahome.com
kubectl get crd keycloaks.k8s.keycloak.org
kubectl get crd perconapgclusters.pgv2.percona.com
```

The chart creates a ClusterIP `rfr-<redisCluster.name>` Service (selecting the Redis master pod). Set `app.redisUrl` to `redis://rfr-<name>:6379` when you enable Redis.

## 4. Install KAIROS MCP chart

```bash
cd helm/kairos-mcp
helm dependency update
helm install kairos . -n kairos --create-namespace -f my-values.yaml
```
