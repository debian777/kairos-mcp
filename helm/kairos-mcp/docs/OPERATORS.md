# Step-by-step operator installation

Install these operators **before** you install the KAIROS MCP chart when you use chart-managed **Redis**, **Keycloak**, or **Postgres** CRs (`redisCluster.enabled`, `keycloakInstance.enabled`, `postgresCluster.enabled`).

If you install an operator outside the chart release namespace, you must also configure that operator to watch the release namespace and grant it RBAC in that namespace. The default upstream installs watch only their own namespace. See [Keycloak operator installation](https://www.keycloak.org/operator/installation) for upstream Keycloak references.

## Repository install (recommended)

From the repository root, use Kustomize (requires `kubectl` and `kustomize build --enable-helm` for local preview; `kubectl apply -k` uses embedded Helm support in recent `kubectl`):

```bash
kubectl apply -k helm/operators
```

See **[helm/operators/README.md](../../operators/README.md)** for rollout waits and version pins (**Redis 3.2.9**, **Keycloak 26.5.6**, **pg-operator 2.8.2**).

For **ngrok** and **`GatewayClass/ngrok`**, create the credentials Secret as described in **[helm/infrastructure/README.md](../../infrastructure/README.md)**, then:

```bash
kubectl apply -k helm/infrastructure
```

---

## Manual install (without Kustomize)

### Helm chart repositories (once)

```bash
helm repo add redis-operator https://spotahome.github.io/redis-operator
helm repo add percona https://percona.github.io/percona-helm-charts/
helm repo update
```

---

### 1. Redis operator (Spotahome)

Uses the **RedisFailover** CRD. Do **not** use Helm chart **≥3.3.0** (CRDs under `crds/` are templated and fail to install). Use **3.2.9** (or another **3.2.x**): it keeps the **policy/v1** `PodDisruptionBudget` API required on Kubernetes **1.25+**; **3.1.x** controllers hit `the server could not find the requested resource` on modern clusters.

```bash
helm upgrade --install redis-operator redis-operator/redis-operator -n redis-operator --create-namespace --version 3.2.9
```

Verify: `kubectl get pods -n redis-operator` and `kubectl get crd redisfailovers.databases.spotahome.com`.

The KAIROS chart creates a ClusterIP **`rfr-<redisCluster.name>`** Service (selecting the Redis **master** pod) because some operator versions do not expose that Service; set `app.redisUrl` to `redis://rfr-<name>:6379` (see `helm/values.dev.yaml`).

---

### 2. Keycloak operator

Use the current operator (CRD `keycloaks.k8s.keycloak.org`). The CRDs are separate from the operator deployment.

```bash
kubectl create namespace keycloak
export KEYCLOAK_OPERATOR_VERSION=26.5.6

kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloaks.k8s.keycloak.org-v1.yml"
kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloakrealmimports.k8s.keycloak.org-v1.yml"
kubectl -n keycloak apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/kubernetes.yml"
kubectl create namespace kairos
kubectl apply -f - <<'EOF'
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: keycloak-operator-watch
  namespace: kairos
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: keycloakcontroller-cluster-role
subjects:
  - kind: ServiceAccount
    name: keycloak-operator
    namespace: keycloak
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: keycloak-realmimport-watch
  namespace: kairos
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: keycloakrealmimportcontroller-cluster-role
subjects:
  - kind: ServiceAccount
    name: keycloak-operator
    namespace: keycloak
EOF
kubectl -n keycloak set env deployment/keycloak-operator \
  QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKREALMIMPORTCONTROLLER_NAMESPACES=kairos \
  QUARKUS_OPERATOR_SDK_CONTROLLERS_KEYCLOAKCONTROLLER_NAMESPACES=kairos
```

Verify: `kubectl get pods -n keycloak` and `kubectl get crd keycloaks.k8s.keycloak.org`.

The chart renders `k8s.keycloak.org/v2alpha1` Keycloak resources and expects PostgreSQL-backed Keycloak configuration when you enable the Keycloak instance in values.

---

### 3. Percona PostgreSQL operator

```bash
helm install pg-operator percona/pg-operator -n kairos --create-namespace --version 2.8.2
```

Verify: `kubectl get pods -n kairos` and `kubectl get crd perconapgclusters.pgv2.percona.com`.

---

### 4. ngrok operator and GatewayClass

Create the **ngrok** credentials Secret in `ngrok-operator` (see **[helm/infrastructure/README.md](../../infrastructure/README.md)**), then install the ngrok operator Helm chart and apply `GatewayClass/ngrok`, or use **`kubectl apply -k helm/infrastructure`**.

Verify: `kubectl get gatewayclass ngrok`.

---

### 5. Install KAIROS MCP chart

```bash
helm dependency build helm/kairos-mcp
helm upgrade --install kairos helm/kairos-mcp -n kairos --create-namespace -f my-values.yaml
```

Create the embedding **Secret** `kairos-mcp-embedding` (or set `app.embedding.openai.existingSecret`) before or after install; the default chart values expect that name.

Set `app.qdrantUrl` only if Qdrant is not the bundled subchart at `http://<release>-qdrant:6333`. Set `app.keycloakUrl`, `app.keycloakInternalUrl`, and `app.redisUrl` when you enable those components. Credentials are autogenerated into a Kubernetes Secret unless you set `credentials.existingSecret`.
