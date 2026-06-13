# Fix KeycloakRealmImport ArgoCD Continuous Override

## Problem

ArgoCD does not honor Helm hooks. It renders all templates via `helm template` (where `.Release.IsInstall` is always `true`), so the `KeycloakRealmImport` CR persists as a synced resource. The Keycloak operator continuously reconciles it, reverting any manual Keycloak changes (clients, roles, mappers, etc.).

## Design

The KeycloakRealmImport CR should only exist on first installation. Two mechanisms ensure this:

1. **Existing `{{- if .Release.IsInstall }}`** -- works for native Helm users.
2. **`lookup` guard** -- same pattern as [credentials-secret-generator-job.yaml](file:///Users/jakub.plichcinski/local/git/github.com/debian777/kairos-mcp/helm/kairos-mcp/templates/credentials-secret-generator-job.yaml) (line 2-3). Checks if the `KeycloakRealmImport` resource already exists in the cluster; if it does, skip rendering. Works for ArgoCD when `spec.source.helm.enableLookup: true`.

No mode toggle, no seed Job. The CR is created once by the operator on first install and never re-rendered.

**Note for ArgoCD users:** `spec.source.helm.enableLookup` must be `true` on the ArgoCD Application for `lookup` to work. Without it, `lookup` returns nil and the CR will re-render. This is documented in values.yaml.

## Task 1: Guard existing KeycloakRealmImport CR with `lookup`

File: `helm/kairos-mcp/templates/keycloak-realm-import.yaml`

Add a `lookup` call (line 1, after the existing guard variables) to skip rendering
when the resource already exists in the cluster:

```go-template
{{- $existingImport := lookup "k8s.keycloak.org/v2alpha1" "KeycloakRealmImport" .Release.Namespace .Values.keycloakRealmImport.name -}}
```

Then change the outer guard on line 1 from:
```
{{- if and .Values.keycloakRealmImport.enabled .Values.keycloakInstance.enabled (not .Values.keycloakInstance.useOwnCluster) }}
```
to:
```
{{- if and .Values.keycloakRealmImport.enabled .Values.keycloakInstance.enabled (not .Values.keycloakInstance.useOwnCluster) (not $existingImport) }}
```

Remove the now-redundant `{{- if .Release.IsInstall }}` block (line 30) and its closing `{{- end }}` (line 47) -- the `lookup` guard supersedes it.

## Task 2: Update values.yaml comment

File: `helm/kairos-mcp/values.yaml` (around line 204)

Update the comment above `keycloakRealmImport` to document the ArgoCD lookup requirement:
```yaml
# First-install-only KeycloakRealmImport (operator imports realm, then CR is not re-rendered).
# ArgoCD: requires spec.source.helm.enableLookup: true on the Application resource.
# Requires keycloakInstance.enabled and Keycloak operator.
```

## Task 3: Add DCR stale-client cleanup CronJob

DCR-registered clients (from MCP hosts like Cursor) accumulate in Keycloak with no built-in expiration.
Add an optional CronJob that periodically removes stale dynamic clients.

### values.yaml additions

```yaml
keycloakDcrCleanup:
  enabled: false
  # KAIROS-seeded clients that are never pruned (clientId exact match).
  protectedClients:
    - kairos-mcp
    - kairos-cli
  # Remove DCR clients first seen more than N days ago.
  staleAfterDays: 30
  schedule: "0 3 * * 0"   # weekly Sunday 03:00
  image: "docker.io/curlimages/curl:8.12.1"
  # If true, log candidates but do not delete (safe first-run).
  dryRun: false
  backoffLimit: 2
  successfulJobsHistoryLimit: 2
  failedJobsHistoryLimit: 3
```

### New file: `helm/kairos-mcp/templates/keycloak-dcr-cleanup-cronjob.yaml`

Guard: `keycloakDcrCleanup.enabled` AND `keycloakInstance.enabled` AND NOT `useOwnCluster`.

CronJob container shell script logic:

1. Obtain admin access token via `POST /<httpRelativePath>/realms/master/protocol/openid-connect/token`
   (credentials from mounted `<keycloak-name>-initial-admin` Secret).
2. `GET /<httpRelativePath>/admin/realms/<realm>/clients?search=&max=2000` -- list all clients.
3. Filter out clients whose `clientId` is in `protectedClients` allowlist.
4. Filter to DCR clients only: clients that have `registration_access_token` in
   their representation (set by Keycloak on DCR creation per RFC 7591).
5. State tracking via ConfigMap `<release>-dcr-cleanup-state`:
   - GET current ConfigMap (or start empty).
   - Parse `seen_clients` JSON: `{ "<clientId>": "<firstSeenISO>" }`.
   - For each DCR client: if not in `seen_clients`, record current timestamp.
   - Prune entries from `seen_clients` for clients no longer returned by Keycloak.
   - PATCH the ConfigMap back (kubectl apply).
6. For each DCR client whose `firstSeen` is older than `staleAfterDays`:
   - If `dryRun: true` -- log `[DRY-RUN] would delete <clientId> (first seen: <date>)`.
   - Else `DELETE /<httpRelativePath>/admin/realms/<realm>/clients/<uuid>`.
   - Log result count summary.

Annotations:
- `argocd.argoproj.io/sync-options: Skip=true` (CronJob is ArgoCD-managed but
  the Jobs it spawns are not synced -- standard ArgoCD CronJob pattern).

Security context: non-root, drop all caps, no privilege escalation.
`concurrencyPolicy: Forbid`, `restartPolicy: OnFailure`.

### New file: `helm/kairos-mcp/templates/keycloak-dcr-cleanup-rbac.yaml`

ServiceAccount + Role (get/list/patch ConfigMaps in namespace) + RoleBinding.
Guard: same as CronJob.

### Helm template validation (add to Task 4)
```bash
helm template test-release helm/kairos-mcp \
  --set keycloakDcrCleanup.enabled=true \
  --set keycloakInstance.enabled=true
```

Verify CronJob renders, RBAC present, protectedClients injected into script env.

## Task 4: Helm lint and full template validation

Run all template validation commands:
```bash
# realm import (first install -- lookup returns nil, CR renders)
helm template test-release helm/kairos-mcp \
  --set keycloakRealmImport.enabled=true \
  --set keycloakInstance.enabled=true \
  --set keycloakRealmImport.publicBaseUrl=http://localhost

# DCR cleanup
helm template test-release helm/kairos-mcp \
  --set keycloakDcrCleanup.enabled=true \
  --set keycloakInstance.enabled=true

# Helm lint
helm lint helm/kairos-mcp
```

Verify:
- KeycloakRealmImport CR renders (lookup returns nil in template-only mode)
- DCR cleanup: CronJob + RBAC render, protectedClients injected, dryRun flag wired
- Helm lint passes
