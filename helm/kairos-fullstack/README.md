# KAIROS full stack Helm chart

Deploys **Qdrant** (HA, odd replicas for quorum, default 3) and **kairos-mcp** app (2 replicas). Redis, Keycloak, and Postgres can be **external** (your operators) or created by this chart via operator CRs.

## Prerequisites

- Kubernetes cluster
- **Operators** installed when using chart-created clusters (see [docs/OPERATORS.md](docs/OPERATORS.md)):
  - Redis (Spotahome redis-operator)
  - Keycloak operator
  - Postgres (Percona PostgreSQL operator)

## Credentials

- Set `credentials.autoGenerate: true` (default): a **pre-install hook** creates a Secret with random `redis-password`, `keycloak-db-password`, `session-secret`. Use `credentials.existingSecret` to use your own.
- Set `app.redisUrl`, `app.qdrantUrl`, `app.keycloakInternalUrl` (and optionally `app.auth.callbackBaseUrl`) in values.

## Cluster configuration

- **Use your own clusters:** set `redisCluster.useOwnCluster`, `keycloakInstance.useOwnCluster`, or `postgresCluster.useOwnCluster` to `true` and set app.*Url. No CRs are created.
- **Chart creates clusters:** set `redisCluster.enabled`, `keycloakInstance.enabled`, or `postgresCluster.enabled` to `true`. Operators must be installed first.

## Operator pre-check

When any of `redisCluster.enabled`, `keycloakInstance.enabled`, or `postgresCluster.enabled` is `true`, a **pre-install hook** checks that required operator CRDs exist (e.g. `redisfailovers.databases.spotahome.com`, `keycloaks.k8s.keycloak.org`, `perconapgclusters.pgv2.percona.com`). See [docs/OPERATORS.md](docs/OPERATORS.md).

## Gateway API

Set `gateway.enabled: true`, `gateway.hostname`, and `gateway.gatewayClassName`. MCP at `https://<hostname>/`, Keycloak at `https://<hostname>/sso`. TLS via cert-manager (Let's Encrypt) when `gateway.tls.certManager.enabled: true`.

## Monitoring (ServiceMonitor and alerts)

Requires [Prometheus Operator](https://prometheus-operator.dev/). App exposes `/metrics` on `app.metricsPort` (9090); Qdrant on port 6333. Enable `monitoring.serviceMonitor.app.enabled` and `monitoring.serviceMonitor.qdrant.enabled`; set `release` (e.g. `prometheus`) so Prometheus selects them. Optional: `monitoring.serviceMonitor.redis` / `keycloak` / `postgres` with `serviceNamespace` and `serviceSelector`. Set `monitoring.prometheusRule.enabled: true` for default alerts (KAIROSAppDown, KAIROSAppHighErrorRate, KAIROSQdrantDown); set `monitoring.prometheusRule.release` for selection.

## Install

```bash
helm dependency update
helm install kairos . -n kairos --create-namespace -f my-values.yaml
```

In `my-values.yaml` set at least `app.redisUrl`, `app.qdrantUrl`, `app.keycloakInternalUrl`, and `app.auth.callbackBaseUrl` when using auth.
