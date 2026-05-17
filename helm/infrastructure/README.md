# Infrastructure (OLM)

This directory contains cluster infrastructure prerequisites used by KAIROS MCP:

- `GatewayClass/ngrok`
- ngrok operator installation via OLM (`CatalogSource` + `Subscription`)

## Prerequisite: OLM

Install OLM on your cluster following the official guide:

https://olm.operatorframework.io/docs/getting-started/

## Install

```bash
kubectl apply -k helm/infrastructure
```

## ngrok catalog

The ngrok operator is not installed from the default OperatorHub catalog in this repo.
`helm/infrastructure/catalogsource-ngrok.yaml` assumes you provide and publish an OCI image that serves a gRPC catalog (index image) containing an `ngrok-operator` package and a `stable` channel.

If you publish your catalog under a different image/tag, update:

- `helm/infrastructure/catalogsource-ngrok.yaml` → `spec.image`

## ngrok credentials

Do not commit ngrok credentials to git. Create the secret at runtime in the `ngrok-operator` namespace:

```bash
kubectl create secret generic ngrok-k8s-credentials -n ngrok-operator \
  --from-literal=API_KEY="$NGROK_API_KEY" \
  --from-literal=AUTHTOKEN="$NGROK_AUTHTOKEN"
```
