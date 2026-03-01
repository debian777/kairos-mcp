# Step-by-step operator installation

Install these operators **before** installing the KAIROS full stack Helm chart. The chart can create cluster instances (Redis, Keycloak, Postgres) via CRs if the operators are present, or you can use your own clusters and only set connection URLs in values.

---

## 1. Redis operator (Spotahome)

Uses the **RedisFailover** CRD for HA Redis with Sentinel.

### 1.1 Install the operator

The latest chart (3.3.x) has a [CRD template bug](https://github.com/spotahome/redis-operator) that produces invalid YAML; use **chart version 3.1.6** which ships a static CRD.

```bash
# Add Helm repo and install operator (single namespace or cluster-wide)
helm repo add redis-operator https://spotahome.github.io/redis-operator
helm repo update

# Install in namespace redis-operator (or your chosen namespace)
kubectl create namespace redis-operator
# Pin to 3.1.6: newer chart CRD template breaks install (see above)
helm install redis-operator redis-operator/redis-operator -n redis-operator --version 3.1.6
```

### 1.2 Verify

```bash
kubectl get pods -n redis-operator
# CRD should exist
kubectl get crd redisfailovers.databases.spotahome.com
```

### 1.3 Create a cluster (optional)

Either let the KAIROS chart create a RedisFailover CR (set `redisCluster.enabled: true` in values), or create one manually:

```bash
kubectl apply -f - <<EOF
apiVersion: databases.spotahome.com/v1
kind: RedisFailover
metadata:
  name: kairos-redis
  namespace: redis-operator
spec:
  sentinel:
    replicas: 2
  redis:
    replicas: 2
    # auth: secretPath for password (create secret with redis-password key)
EOF
```

Then set `app.redisUrl` to the Redis service (e.g. `redis://kairos-redis-rfr.redis-operator.svc:6379` or with auth from the secret). If the chart generates credentials, the Secret has key `redis-password`; some operators expect key `password` — in that case add `redisCluster.customSpec.auth.secretPath` to a secret that has key `password`, or create that secret from the same value.

---

## 2. Keycloak operator

Manages Keycloak instances via the **Keycloak** CRD.

### 2.1 Install (OLM – recommended if you use OLM)

```bash
# Create namespace and install via OLM (Operator Lifecycle Manager)
kubectl create namespace keycloak

# If using OLM, create a Subscription (adjust source/sourceNamespace to your catalog)
kubectl apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: keycloak-operator
  namespace: keycloak
spec:
  channel: fast
  name: keycloak-operator
  source: operatorhubio-catalog
  sourceNamespace: olm
  installPlanApproval: Manual
EOF
# Approve the install plan when created:
# kubectl get installplan -n keycloak
# kubectl patch installplan <name> -n keycloak --type merge -p '{"spec":{"approved":true}}'
```

### 2.2 Install (kubectl, without OLM)

Use the version and URLs from [Keycloak operator installation](https://www.keycloak.org/operator/installation). CRDs are separate from the operator deployment.

```bash
kubectl create namespace keycloak

# Replace VERSION with the desired operator version (e.g. 26.5.4)
export KEYCLOAK_OPERATOR_VERSION=26.5.4

# 1) Install CRDs (cluster-scoped)
kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloaks.k8s.keycloak.org-v1.yml"
kubectl apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/keycloakrealmimports.k8s.keycloak.org-v1.yml"

# 2) Install operator deployment in keycloak namespace
kubectl -n keycloak apply -f "https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/${KEYCLOAK_OPERATOR_VERSION}/kubernetes/kubernetes.yml"
```

To install in a different namespace, after apply patch the ClusterRoleBinding:  
`kubectl patch clusterrolebinding keycloak-operator-clusterrole-binding --type='json' -p='[{"op": "replace", "path": "/subjects/0/namespace", "value":"YOUR_NAMESPACE"}]'`  
then `kubectl rollout restart -n YOUR_NAMESPACE Deployment/keycloak-operator`.

### 2.3 Verify

```bash
kubectl get pods -n keycloak
kubectl get crd keycloaks.k8s.keycloak.org keycloakrealmimports.k8s.keycloak.org
```

### 2.4 Create Keycloak instance (optional)

Either let the KAIROS chart create a Keycloak CR (set `keycloakInstance.enabled: true`) or create one manually and configure DB to point at your Postgres. Then set `app.keycloakInternalUrl` and `app.auth.*` in values.

**Note:** The kubectl install above uses the **new** Keycloak operator (CRD `keycloaks.k8s.keycloak.org`, apiVersion `k8s.keycloak.org/v1` or `v2alpha1`). The chart’s Keycloak CR template currently targets the **legacy** operator (`keycloak.org/v1alpha1`). If you installed via the steps in §2.2, either use `keycloakInstance.useOwnCluster: true` and create your Keycloak CR manually with the [new CR spec](https://www.keycloak.org/operator/installation), or install the legacy operator (e.g. via OLM) and use the chart-generated CR as-is.

---

## 3. Percona PostgreSQL operator

Manages Postgres clusters via the **PerconaPGCluster** CRD (Keycloak DB).

### 3.1 Install the operator

```bash
helm repo add percona https://percona.github.io/percona-helm-charts/
helm repo update

kubectl create namespace percona-pg
helm install pg-operator percona/pg-operator -n percona-pg
```

### 3.2 Verify

```bash
kubectl get pods -n percona-pg
kubectl get crd perconapgclusters.pgv2.percona.com
```

### 3.3 Create a cluster (optional)

Either let the KAIROS chart create a PerconaPGCluster CR (set `postgresCluster.enabled: true`) or install the DB chart:

```bash
helm install keycloak-db percona/pg-db -n percona-pg -f - <<EOF
instances:
  - name: instance1
    replicas: 2
    dataVolumeClaimSpec:
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: 5Gi
proxy:
  pgBouncer:
    replicas: 2
EOF
```

Then create a DB/user for Keycloak (see Percona docs) and point Keycloak’s external DB at the cluster primary/pgbouncer service. Set `app.keycloakInternalUrl` to your Keycloak service.

---

## Credentials (chart-managed)

The chart can create a Secret with generated passwords (pre-install hook). Passwords are **not** saved anywhere except in that Kubernetes Secret. Keys: `redis-password`, `keycloak-db-password`, `session-secret`. Disable with `credentials.autoGenerate: false` or use your own with `credentials.existingSecret`.

For **Keycloak external DB**, create a Secret (e.g. `keycloak-db`) with: `DB_VENDOR=postgres`, `DB_ADDR`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, and reference it in the Keycloak CR (or in `keycloakInstance.customSpec`). You can take `DB_PASSWORD` from the chart-generated secret (`keycloak-db-password`) by copying it once after install.

---

## 4. Install KAIROS full stack chart

After the operators (and optionally clusters) are in place:

```bash
cd helm/kairos-fullstack
helm dependency update
helm install kairos . -n kairos --create-namespace -f my-values.yaml
```

In `my-values.yaml`:

- Set `app.redisUrl`, `app.qdrantUrl`, `app.keycloakInternalUrl` to your cluster endpoints.
- Or enable `redisCluster.enabled` / `keycloakInstance.enabled` / `postgresCluster.enabled` so the chart creates the CRs (operators must be installed).
- Use `credentials.existingSecret` or let the chart create a Secret with generated passwords (see README).
