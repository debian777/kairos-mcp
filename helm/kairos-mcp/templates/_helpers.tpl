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

{{- define "kairos.qdrantServiceName" -}}
{{- $q := default dict .Values.qdrant -}}
{{- if $q.fullnameOverride -}}
{{- $q.fullnameOverride -}}
{{- else if $q.nameOverride -}}
{{- printf "%s-%s" .Release.Name $q.nameOverride -}}
{{- else -}}
{{- printf "%s-qdrant" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "kairos.valkeyServiceName" -}}
{{- $v := default dict .Values.valkey -}}
{{- if $v.fullnameOverride -}}
{{- $v.fullnameOverride -}}
{{- else if $v.nameOverride -}}
{{- printf "%s-%s" .Release.Name $v.nameOverride -}}
{{- else -}}
{{- printf "%s-valkey" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "kairos.app.redisUrl" -}}
{{- if .Values.app.redisUrl -}}
{{- .Values.app.redisUrl -}}
{{- else if .Values.valkey.enabled -}}
{{- printf "redis://%s:6379" (include "kairos.valkeyServiceName" .) -}}
{{- else if and .Values.redisCluster.enabled (not .Values.redisCluster.useOwnCluster) -}}
{{- $redisNs := default .Release.Namespace .Values.redisCluster.namespace -}}
{{- $redisHost := printf "rfr-%s" .Values.redisCluster.name -}}
{{- if ne $redisNs .Release.Namespace -}}
{{- printf "redis://%s.%s.svc:6379" $redisHost $redisNs -}}
{{- else -}}
{{- printf "redis://%s:6379" $redisHost -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "kairos.app.qdrantUrl" -}}
{{- if .Values.app.qdrantUrl -}}
{{- .Values.app.qdrantUrl -}}
{{- else if .Values.qdrant.enabled -}}
{{- printf "http://%s:6333" (include "kairos.qdrantServiceName" .) -}}
{{- end -}}
{{- end -}}

{{- define "kairos.keycloakServiceName" -}}
{{- $gateway := default dict .Values.gateway -}}
{{- $routes := default dict $gateway.routes -}}
{{- $route := default dict $routes.keycloak -}}
{{- $kc := default dict .Values.keycloakInstance -}}
{{- $kcName := default "keycloak" $kc.name -}}
{{- default (printf "%s-service" $kcName) $route.serviceName -}}
{{- end -}}

{{- define "kairos.keycloakServiceNamespace" -}}
{{- $gateway := default dict .Values.gateway -}}
{{- $routes := default dict $gateway.routes -}}
{{- $route := default dict $routes.keycloak -}}
{{- $kc := default dict .Values.keycloakInstance -}}
{{- default (default .Release.Namespace $kc.namespace) $route.serviceNamespace -}}
{{- end -}}

{{- define "kairos.app.keycloakInternalUrl" -}}
{{- if .Values.app.keycloakInternalUrl -}}
{{- .Values.app.keycloakInternalUrl -}}
{{- else if and .Values.keycloakInstance.enabled (not .Values.keycloakInstance.useOwnCluster) -}}
{{- $kc := default dict .Values.keycloakInstance -}}
{{- $relativePath := default "/sso" $kc.httpRelativePath -}}
{{- $gateway := default dict .Values.gateway -}}
{{- $routes := default dict $gateway.routes -}}
{{- $route := default dict $routes.keycloak -}}
{{- $servicePort := default (default 8080 $kc.http.httpPort) $route.port -}}
{{- $serviceName := include "kairos.keycloakServiceName" . -}}
{{- $serviceNamespace := include "kairos.keycloakServiceNamespace" . -}}
{{- if ne $serviceNamespace .Release.Namespace -}}
{{- printf "http://%s.%s.svc:%v%s" $serviceName $serviceNamespace $servicePort $relativePath -}}
{{- else -}}
{{- printf "http://%s:%v%s" $serviceName $servicePort $relativePath -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "kairos.publicScheme" -}}
{{- $gw := default dict .Values.gateway -}}
{{- $tls := default dict $gw.tls -}}
{{- $cm := default dict $tls.certManager -}}
{{- $tlsEnabled := or (ne (default "" $tls.secretName | trim) "") (and (default false $cm.enabled) (ne (default "" $cm.secretName | trim) "")) -}}
{{- ternary "https" "http" $tlsEnabled -}}
{{- end -}}

{{- define "kairos.publicHost" -}}
{{- $gw := default dict .Values.gateway -}}
{{- $host := default "" $gw.hostname | trim -}}
{{- if and $gw.enabled (ne $host "") -}}
{{- $host -}}
{{- else -}}
{{- .Values.global.hostname -}}
{{- end -}}
{{- end -}}

{{- define "kairos.publicPort" -}}
{{- $scheme := include "kairos.publicScheme" . | trim -}}
{{- ternary 443 80 (eq $scheme "https") -}}
{{- end -}}

{{- define "kairos.publicOrigin" -}}
{{- $scheme := include "kairos.publicScheme" . | trim -}}
{{- $host := include "kairos.publicHost" . | trim -}}
{{- printf "%s://%s" $scheme $host -}}
{{- end -}}

{{- define "kairos.app.publicBaseUrl" -}}
{{- $callbackBase := .Values.app.auth.callbackBaseUrl | default "" | trim -}}
{{- if ne $callbackBase "" -}}
{{- trimSuffix "/" $callbackBase -}}
{{- else if and .Values.gateway.enabled (ne (default "" .Values.gateway.hostname | trim) "") -}}
{{- include "kairos.publicOrigin" . | trim -}}
{{- else -}}
{{- printf "https://%s" .Values.global.hostname -}}
{{- end -}}
{{- end -}}

{{- define "kairos.app.keycloakUrl" -}}
{{- if .Values.app.keycloakUrl -}}
{{- .Values.app.keycloakUrl -}}
{{- else -}}
{{- $baseUrl := include "kairos.app.publicBaseUrl" . | trim -}}
{{- $gateway := default dict .Values.gateway -}}
{{- $routes := default dict $gateway.routes -}}
{{- $route := default dict $routes.keycloak -}}
{{- $path := default (default "/sso" .Values.keycloakInstance.httpRelativePath) $route.path -}}
{{- if not (hasPrefix "/" $path) -}}
{{- $path = printf "/%s" $path -}}
{{- end -}}
{{- printf "%s%s" (trimSuffix "/" $baseUrl) $path -}}
{{- end -}}
{{- end -}}
