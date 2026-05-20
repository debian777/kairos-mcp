{{/*
Determine ingress mode: "gateway" | "ingress" | "none".
Explicit .Values.gateway.mode wins; "auto" picks based on gatewayClassName presence.
*/}}
{{- define "kairos.ingressMode" -}}
{{- $gw := default dict .Values.gateway -}}
{{- $mode := default "auto" $gw.mode -}}
{{- if eq $mode "auto" -}}
  {{- if $gw.gatewayClassName -}}gateway{{- else if $gw.ingressClassName -}}ingress{{- else -}}none{{- end -}}
{{- else -}}
  {{- $mode -}}
{{- end -}}
{{- end -}}

{{- define "kairos.adminHostname" -}}
{{- $gw := default dict .Values.gateway -}}
{{- $routes := default dict $gw.routes -}}
{{- $kc := default dict $routes.keycloak -}}
{{- $lock := default dict $kc.adminLockdown -}}
{{- $enabled := ternary $lock.enabled true (hasKey $lock "enabled") -}}
{{- if and $enabled $gw.hostname -}}
  {{- default (printf "admin.%s" $gw.hostname) $lock.adminHostname -}}
{{- end -}}
{{- end -}}

{{- define "kairos.credentialsLegacySecretName" -}}
{{- printf "kairos-mcp-credentials" -}}
{{- end -}}

{{- define "kairos.credentialsPreferredSecretName" -}}
{{- $name := default "" .Values.credentials.name | trim -}}
{{- if $name -}}
{{- $name -}}
{{- else -}}
{{- printf "%s-credentials" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "kairos.credentialsSecretName" -}}
{{- $existing := default "" .Values.credentials.existingSecret | trim -}}
{{- if $existing -}}
{{- $existing -}}
{{- else -}}
{{- $preferred := include "kairos.credentialsPreferredSecretName" . -}}
{{- $legacy := include "kairos.credentialsLegacySecretName" . -}}
{{- $preferredObj := lookup "v1" "Secret" .Release.Namespace $preferred -}}
{{- if $preferredObj -}}
{{- $preferred -}}
{{- else -}}
{{- $legacyObj := lookup "v1" "Secret" .Release.Namespace $legacy -}}
{{- if $legacyObj -}}
{{- $legacy -}}
{{- else -}}
{{- $preferred -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
