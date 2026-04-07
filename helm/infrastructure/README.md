# Infrastructure (Kustomize)

Installs the **ngrok Kubernetes operator** (with Gateway API enabled) and **`GatewayClass/ngrok`**.

## Prerequisites

- Gateway API CRDs on the cluster (k3s/k3d often include them).
- `kubectl`, `helm`, and **Kustomize** with `kustomize build --enable-helm`.

## Secret (required, not in git)

Create **`ngrok-k8s-credentials`** in namespace **`ngrok-operator`** before or after namespaces exist:

```bash
kubectl create namespace ngrok-operator --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic ngrok-k8s-credentials -n ngrok-operator \
  --from-literal=API_KEY="$NGROK_API_KEY" \
  --from-literal=AUTHTOKEN="$NGROK_AUTHTOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Use values from the [ngrok dashboard](https://dashboard.ngrok.com/) or your local `ngrok.yml` (`agent.api_key`, `agent.authtoken`).

Alternatives: **External Secrets**, **Sealed Secrets**, or **SOPS**-encrypted overlays—keep credentials out of version control.

## Apply

```bash
kubectl apply -k helm/infrastructure
```

Wait for the operator:

```bash
kubectl rollout status deployment/ngrok-operator-manager -n ngrok-operator --timeout=120s
kubectl rollout status deployment/ngrok-operator-agent -n ngrok-operator --timeout=120s
kubectl wait --for=condition=Accepted gatewayclass/ngrok --timeout=120s
```

## Pin chart version (optional)

To pin **ngrok-operator** Helm chart version, add `version: "x.y.z"` under the `ngrok-operator` entry in `kustomization.yaml` (`helmCharts`).
