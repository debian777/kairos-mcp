# KAIROS MCP Helm chart (`helm/kairos-mcp`)

Deploys **Qdrant** and the optional **kairos-mcp** app. Redis, Keycloak, and
Postgres can be external (your operators) or created by this chart through
operator CRs.

## Prerequisites

- Kubernetes cluster
- **Operators** installed when using chart-created clusters (see [docs/OPERATORS.md](docs/OPERATORS.md)):
  - Redis (Spotahome redis-operator)
  - Keycloak operator
  - Postgres (Percona PostgreSQL operator)

## Credentials

The chart creates only internal bootstrap secrets. When you enable the app, you
must still provide an embedding provider configuration.

- Set `credentials.autoGenerate: true` (default): a pre-install hook creates a
  Secret with random `redis-password`, `keycloak-db-password`, and
  `session-secret`. Use `credentials.existingSecret` to use your own.
- Set `app.extraEnv` to inject your embedding provider. Use either
  `OPENAI_API_KEY` plus `OPENAI_EMBEDDING_MODEL`, or `TEI_BASE_URL` plus
  `TEI_MODEL`. Prefer `valueFrom.secretKeyRef`.
- Set `app.qdrantUrl`, `app.keycloakUrl`, and `app.keycloakInternalUrl`. When
  `qdrant.enabled: true`, you can leave `app.qdrantUrl` empty to use the
  in-cluster Qdrant service.
  Set `app.redisUrl` only when you want Redis.
- **Browser OIDC:** set `app.auth.enabled: true`, `app.auth.realm` (default
  `kairos`), `app.auth.clientId` (default `kairos-mcp`), and
  `app.auth.callbackBaseUrl` to your **public app origin** (e.g.
  `https://your-host.ngrok-free.dev`, no trailing slash). The app needs
  `session-secret` in the credentials Secret (hook or `existingSecret`).
- **Realm import:** set `keycloakRealmImport.enabled: true` to apply a
  `KeycloakRealmImport` for `kairos` with `kairos-mcp` / `kairos-cli`
  clients. Redirect URIs use `https://<gateway.hostname>/…` unless you set
  `keycloakRealmImport.publicHost`. If the realm already exists, reconcile or
  adjust clients in Keycloak Admin instead of duplicating imports.

## Cluster configuration

- **Use your own clusters:** set `redisCluster.useOwnCluster`, `keycloakInstance.useOwnCluster`, or `postgresCluster.useOwnCluster` to `true` and set app.*Url. No CRs are created.
- **Chart creates clusters:** set `redisCluster.enabled`,
  `keycloakInstance.enabled`, or `postgresCluster.enabled` to `true`.
  Operators must be installed first, must watch the release namespace, and
  must have RBAC in that namespace.

## Operator pre-check

When any of `redisCluster.enabled`, `keycloakInstance.enabled`, or `postgresCluster.enabled` is `true`, a **pre-install hook** checks that required operator CRDs exist (e.g. `redisfailovers.databases.spotahome.com`, `keycloaks.k8s.keycloak.org`, `perconapgclusters.pgv2.percona.com`). See [docs/OPERATORS.md](docs/OPERATORS.md).

## Gateway API

Set `gateway.enabled: true`, `gateway.hostname`, and
`gateway.gatewayClassName`. The app route renders only when `app.enabled=true`.
Keycloak is exposed at `https://<hostname>/sso`. For local development, use the
repo-local helper scripts in `helm/.dev/` to install operators and apply the
chart to your local cluster with localhost URLs.
TLS via cert-manager is used only when
`gateway.tls.certManager.enabled=true`.

## Monitoring (ServiceMonitor and alerts)

Requires [Prometheus Operator](https://prometheus-operator.dev/). App exposes `/metrics` on `app.metricsPort` (9090); Qdrant on port 6333. Enable `monitoring.serviceMonitor.app.enabled` and `monitoring.serviceMonitor.qdrant.enabled`; set `release` (e.g. `prometheus`) so Prometheus selects them. Optional: `monitoring.serviceMonitor.redis` / `keycloak` / `postgres` with `serviceNamespace` and `serviceSelector`. Set `monitoring.prometheusRule.enabled: true` for default alerts (KAIROSAppDown, KAIROSAppHighErrorRate, KAIROSQdrantDown); set `monitoring.prometheusRule.release` for selection.

## Install

```bash
helm dependency update
helm install kairos . -n kairos --create-namespace -f my-values.yaml
```

When `app.enabled` is true, the process must supply an embedding provider. The
chart supports OpenAI via `app.embedding.openai.existingSecret` (recommended)
or `app.extraEnv` for TEI (`TEI_BASE_URL`, `TEI_MODEL`).

For local development on a single-node cluster, use `helm/.dev/prepare.sh` and
`helm/.dev/helm-apply.sh` with `helm/.dev/values.local.yaml`. For a starting
point for non-local deployments, see `helm/values.prod.yaml`.

In `my-values.yaml`, set at least `app.keycloakUrl`, `app.keycloakInternalUrl`,
and embedding or `app.extraEnv` when you enable the app. Set `app.qdrantUrl`
when `qdrant.enabled: false`. Set `app.redisUrl` only when you configure Redis.
Set `app.auth.callbackBaseUrl` when using auth.
