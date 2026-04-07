{{/*
In-cluster Qdrant HTTP URL when app.qdrantUrl is not set (subchart Service: <Release.Name>-qdrant:6333).
*/}}
{{- define "kairos.qdrantUrl" -}}
{{- $manual := .Values.app.qdrantUrl | default "" | trim -}}
{{- if ne $manual "" -}}
{{- $manual -}}
{{- else -}}
{{- printf "http://%s-qdrant:6333" .Release.Name -}}
{{- end -}}
{{- end -}}
