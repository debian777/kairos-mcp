# Helm assets

## Layout

- `helm/operators/`: OLM-native operator bootstrap (OperatorGroup + Subscriptions)
- `helm/infrastructure/`: Cluster infrastructure bootstrap (ngrok GatewayClass + ngrok operator via OLM)
- `helm/kairos-mcp/`: KAIROS MCP Helm chart

## Quick start

1. Install OLM on your cluster following the official guide: https://olm.operatorframework.io/docs/getting-started/
2. Install operators:

```bash
kubectl apply -k helm/operators
kubectl apply -k helm/infrastructure
```
