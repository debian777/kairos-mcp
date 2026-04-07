# KAIROS MCP Helm chart (`helm/kairos-mcp`)

Deploys the **kairos-mcp** application and **bundled Qdrant** (Helm subchart). Redis, Keycloak, and Postgres are optional: use external services (`useOwnCluster` + URLs) or enable chart CRs when the matching operators are installed (see [docs/OPERATORS.md](docs/OPERATORS.md)).

## Quick install (defaults)

With no custom values file, the chart installs **app + Qdrant** only: Gateway API routes, Redis/Keycloak/Postgres CRs, and monitoring stay **off** until you enable them.

- **`app.qdrantUrl`** defaults to `http://<release-name>-qdrant:6333` when unset (in-cluster Qdrant Service).
- **`app.embedding.openai.existingSecret`** defaults to **`kairos-mcp-embedding`**. Create that Secret in the release namespace before the app can start:

  ```bash
  kubectl create secret generic kairos-mcp-embedding -n kairos \
    --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY"
  ```

- Use **`app.extraEnv`** for TEI (`TEI_BASE_URL`, `TEI_MODEL`) instead of OpenAI if you prefer.

## Prerequisites

- Kubernetes cluster
- **Operators** (only if you enable chart-managed Redis, Keycloak, or Postgres): install **[helm/operators](../../operators/)** and optionally **[helm/infrastructure](../../infrastructure/)** for ngrok + `GatewayClass`. See [docs/OPERATORS.md](docs/OPERATORS.md).

## Credentials

- **`credentials.autoGenerate: true`** (default): a pre-install hook can create a Secret with random `redis-password`, `keycloak-db-password`, and `session-secret`. Use **`credentials.existingSecret`** to use your own.
- Set **`app.keycloakUrl`**, **`app.keycloakInternalUrl`**, and **`app.redisUrl`** when you use Redis/Keycloak (full-stack overlays such as `helm/values.dev.yaml` show typical URLs).
- **Browser OIDC:** set **`app.auth.enabled: true`**, **`app.auth.callbackBaseUrl`** to your public origin, and **`gateway.hostname`** when exposing routes. **`keycloakRealmImport.enabled: true`** applies the bundled realm JSON (redirect URIs use `https://<gateway.hostname>/…` unless **`keycloakRealmImport.publicHost`** is set).

## Cluster configuration

- **External data plane:** set **`redisCluster.useOwnCluster`**, **`keycloakInstance.useOwnCluster`**, or **`postgresCluster.useOwnCluster`** to **`true`** and set **`app.*` URLs**. No CRs are created.
- **Chart-managed CRs:** set **`redisCluster.enabled`**, **`keycloakInstance.enabled`**, or **`postgresCluster.enabled`** to **`true`**. Operators must be installed first; see [docs/OPERATORS.md](docs/OPERATORS.md).

## Operator pre-check

When any of **`redisCluster.enabled`**, **`keycloakInstance.enabled`**, or **`postgresCluster.enabled`** is **`true`**, a **pre-install hook** checks that required operator CRDs exist. If install fails, apply **`helm/operators`** (or manual steps in OPERATORS.md) and retry.

## Gateway API

Set **`gateway.enabled: true`**, **`gateway.hostname`**, and **`gateway.gatewayClassName`** (e.g. **`ngrok`**) when you want HTTPRoutes. The MCP route renders when **`gateway.hostname`** is set. Keycloak route uses **`gateway.routes.keycloak`**. TLS via cert-manager when **`gateway.tls.certManager.enabled=true`**.

## Monitoring (ServiceMonitor and alerts)

Requires [Prometheus Operator](https://prometheus-operator.dev/). Enable **`monitoring.serviceMonitor.app.enabled`** / **`monitoring.serviceMonitor.qdrant.enabled`** and set **`release`** for selection. Optional Redis/Keycloak/Postgres monitors. **`monitoring.prometheusRule.enabled: true`** for default alerts.

## Install

```bash
helm repo add qdrant https://qdrant.github.io/qdrant-helm
helm dependency build
helm upgrade --install kairos . -n kairos --create-namespace
```

Use **`-f ../values.dev.yaml`** (or your values) for a full-stack example. See **[helm/README.md](../README.md)** for Kustomize operator install order.

## Packaging and release

- Run **`helm dependency build`** (or **`helm dependency update`**) before **`helm package`** so **`charts/*.tgz`** is populated; **`Chart.lock`** should stay committed for reproducible builds.
- **`charts/*.tgz`** is gitignored under this chart; CI/release pipelines should build dependencies before packaging.
- Published artifacts should include vendored subcharts so consumers can **`helm install`** without extra repo setup beyond what `Chart.lock` records.

## Chart tests

From repository root:

```bash
./scripts/test-helm.sh
```
