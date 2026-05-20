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
