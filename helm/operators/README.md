# Operators (OLM)

This directory installs the operators required by the KAIROS MCP Helm chart using OLM primitives:

- `OperatorGroup` (scopes operators to the KAIROS release namespace)
- `Subscription` (installs/upgrades operators from catalogs)

## Prerequisite: OLM

Install OLM on your cluster following the official guide:

https://olm.operatorframework.io/docs/getting-started/

## Install

```bash
kubectl apply -k helm/operators
```

## Configure scope (release namespace)

The default KAIROS release namespace is `kairos`. If you install the chart into a different namespace, update:

- `helm/operators/operatorgroup.yaml` → `spec.targetNamespaces`

## Verify

```bash
kubectl get operatorgroup,subscription,installplan,csv -n operators
kubectl get crd | rg -i 'redisfailovers\\.databases\\.spotahome\\.com|keycloaks\\.k8s\\.keycloak\\.org|perconapgclusters\\.pgv2\\.percona\\.com'
```

If a `Subscription` stays unresolved, validate that the operator exists in your catalogs:

```bash
kubectl get catalogsource -n olm
kubectl get packagemanifest -n olm | rg -i 'redis|keycloak|percona|postgres'
```

Then update the `spec.name` / `spec.channel` in the relevant `subscription-*.yaml` file.
