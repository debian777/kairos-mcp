# Monitoring & Observability

<cite>
**Referenced Files in This Document**
- [metrics-server.ts](file://src/metrics-server.ts)
- [http-metrics-middleware.ts](file://src/http/http-metrics-middleware.ts)
- [registry.ts](file://src/services/metrics/registry.ts)
- [system-metrics.ts](file://src/services/metrics/system-metrics.ts)
- [http-metrics.ts](file://src/services/metrics/http-metrics.ts)
- [embedding-metrics.ts](file://src/services/metrics/embedding-metrics.ts)
- [memory-metrics.ts](file://src/services/metrics/memory-metrics.ts)
- [qdrant-metrics.ts](file://src/services/metrics/qdrant-metrics.ts)
- [anomaly-metrics.ts](file://src/services/metrics/anomaly-metrics.ts)
- [agent-metrics.ts](file://src/services/metrics/agent-metrics.ts)
- [mcp-metrics.ts](file://src/services/metrics/mcp-metrics.ts)
- [structured-logger.ts](file://src/utils/structured-logger.ts)
- [log-core.ts](file://src/utils/log-core.ts)
- [http-health-routes.ts](file://src/http/http-health-routes.ts)
- [health.ts](file://src/services/embedding/health.ts)
- [service.ts](file://src/services/qdrant/service.ts)
- [http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [mcp-audit-emit.ts](file://src/http/mcp-audit-emit.ts)
- [audit-log.md](file://docs/security/audit-log.md)
- [config.ts](file://src/config.ts)
- [audit-mcp-summary.ts](file://src/utils/audit-mcp-summary.ts)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive MCP audit logging infrastructure documentation
- Documented AUDIT_LOG_LEVEL and AUDIT_LOG_FILE configuration variables
- Added MCP tool call, request, and response audit event tracking
- Updated structured logging system to include MCP audit event emission
- Enhanced audit event specifications with correlation IDs and tenant context

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes the monitoring and observability capabilities of KAIROS MCP. It covers metrics collection (performance, system, embedding), health checks (service readiness, database connectivity, external provider status), structured logging with request tracing and audit events, and operational guidance for scraping, alerting, dashboards, and troubleshooting. The system leverages Prometheus-compatible metrics and a robust structured logging pipeline built on Pino. **Updated** to include comprehensive MCP audit logging infrastructure with configurable verbosity levels and dedicated audit file streaming.

## Project Structure
The observability stack is organized around:
- Metrics exposure via a dedicated metrics server and middleware
- A central Prometheus registry with default labels
- Per-domain metric families for HTTP, system, embedding, memory, Qdrant, anomalies, agents, and MCP tools
- Structured logging with HTTP access logs, error tracking, audit event writes, and **MCP audit logging**
- Health endpoints that probe critical dependencies
- **MCP audit logging with configurable verbosity levels and file streaming**

```mermaid
graph TB
subgraph "Application"
A["Express App<br/>HTTP Routes"]
M["HTTP Metrics Middleware"]
S["Structured Logger<br/>(Pino)"]
AE["MCP Audit Emitter"]
end
subgraph "Metrics"
R["Prometheus Registry<br/>(default labels)"]
MS["System Metrics"]
MH["HTTP Metrics"]
ME["Embedding Metrics"]
MM["Memory Metrics"]
MQ["Qdrant Metrics"]
MA["Agent Metrics"]
MI["MCP Tool Metrics"]
AN["Anomaly Metrics"]
end
subgraph "Dedicated Metrics Server"
P["Prometheus Metrics Server<br/>/metrics endpoint"]
end
subgraph "Audit Infrastructure"
AF["Audit File Stream<br/>(Optional)"]
AC["Audit Config<br/>(AUDIT_LOG_LEVEL/AUDIT_LOG_FILE)"]
end
A --> M
M --> MH
A --> S
S --> AE
AE --> AF
AC --> AE
MH --> R
MS --> R
ME --> R
MM --> R
MQ --> R
MA --> R
MI --> R
AN --> R
R --> P
```

**Diagram sources**
- [metrics-server.ts:19-43](file://src/metrics-server.ts#L19-L43)
- [http-metrics-middleware.ts:15-71](file://src/http/http-metrics-middleware.ts#L15-L71)
- [registry.ts:11-18](file://src/services/metrics/registry.ts#L11-L18)
- [system-metrics.ts:10-41](file://src/services/metrics/system-metrics.ts#L10-L41)
- [http-metrics.ts:11-47](file://src/services/metrics/http-metrics.ts#L11-L47)
- [embedding-metrics.ts:11-39](file://src/services/metrics/embedding-metrics.ts#L11-L39)
- [memory-metrics.ts:11-32](file://src/services/metrics/memory-metrics.ts#L11-L32)
- [qdrant-metrics.ts:11-40](file://src/services/metrics/qdrant-metrics.ts#L11-L40)
- [agent-metrics.ts:12-39](file://src/services/metrics/agent-metrics.ts#L12-L39)
- [mcp-metrics.ts:11-63](file://src/services/metrics/mcp-metrics.ts#L11-L63)
- [anomaly-metrics.ts:4-9](file://src/services/metrics/anomaly-metrics.ts#L4-L9)
- [mcp-audit-emit.ts:1-75](file://src/http/mcp-audit-emit.ts#L1-L75)
- [structured-logger.ts:46-48](file://src/utils/structured-logger.ts#L46-L48)
- [config.ts:85-91](file://src/config.ts#L85-L91)

**Section sources**
- [metrics-server.ts:19-43](file://src/metrics-server.ts#L19-L43)
- [http-metrics-middleware.ts:15-71](file://src/http/http-metrics-middleware.ts#L15-L71)
- [registry.ts:11-18](file://src/services/metrics/registry.ts#L11-L18)

## Core Components
- Metrics registry and default labels
  - Central registry with default labels for service, version, and instance.
  - Tenant ID is not a default label; it is added per-metric based on request context.
- HTTP metrics middleware
  - Tracks requests, durations, payload sizes, and active connections with tenant scoping.
- Dedicated metrics server
  - Exposes a clean /metrics endpoint for Prometheus scraping, with optional /health.
- Structured logging
  - Pino-based logger with redaction, JSON formatting, and audit stream writes.
  - HTTP access logging with request_id, client IP, status, and response time.
  - **MCP audit logging with configurable verbosity levels (0-3) and correlation IDs**.
- Health checks
  - Application readiness probes dependencies: Qdrant, Redis/Cache, and embedding provider.
  - Embedding health supports OpenAI and TEI with provider-specific checks and timeouts.
- **MCP audit infrastructure**
  - **Configurable audit logging with AUDIT_LOG_LEVEL (0-3) controlling event verbosity**.
  - **Optional AUDIT_LOG_FILE for dedicated append-only audit stream**.
  - **Comprehensive audit event tracking for MCP tool calls, requests, and responses**.

**Section sources**
- [registry.ts:11-18](file://src/services/metrics/registry.ts#L11-L18)
- [http-metrics-middleware.ts:15-71](file://src/http/http-metrics-middleware.ts#L15-L71)
- [metrics-server.ts:19-43](file://src/metrics-server.ts#L19-L43)
- [structured-logger.ts:145-178](file://src/utils/structured-logger.ts#L145-L178)
- [http-health-routes.ts:14-89](file://src/http/http-health-routes.ts#L14-L89)
- [health.ts:16-119](file://src/services/embedding/health.ts#L16-L119)
- [mcp-audit-emit.ts:1-75](file://src/http/mcp-audit-emit.ts#L1-L75)
- [audit-log.md:30-35](file://docs/security/audit-log.md#L30-L35)

## Architecture Overview
The observability architecture separates concerns:
- Application HTTP server collects HTTP metrics via middleware and emits structured logs.
- A dedicated metrics server serves Prometheus metrics independently from application traffic.
- Health endpoints probe critical subsystems and return readiness status.
- **MCP audit events are emitted with correlation IDs and optional file streaming based on configuration**.

```mermaid
sequenceDiagram
participant Prom as "Prometheus"
participant App as "HTTP App"
participant MW as "HTTP Metrics Middleware"
participant Reg as "Prometheus Registry"
participant Met as "Metrics Server"
participant Log as "Structured Logger"
participant Audit as "MCP Audit Emitter"
Prom->>Met : GET /metrics
Met->>Reg : register.metrics()
Reg-->>Met : Text exposition
Met-->>Prom : 200 OK
App->>MW : Incoming HTTP request
MW->>Reg : Observe counters/histograms/gauges
App->>Log : HTTP access log record
App->>Audit : MCP audit event (conditional)
App-->>Prom : Application continues serving
```

**Diagram sources**
- [metrics-server.ts:23-32](file://src/metrics-server.ts#L23-L32)
- [http-metrics-middleware.ts:15-71](file://src/http/http-metrics-middleware.ts#L15-L71)
- [registry.ts:11-18](file://src/services/metrics/registry.ts#L11-L18)
- [structured-logger.ts:145-178](file://src/utils/structured-logger.ts#L145-L178)
- [mcp-audit-emit.ts:35-61](file://src/http/mcp-audit-emit.ts#L35-L61)

## Detailed Component Analysis

### Metrics Collection System
- Registry and default labels
  - All metrics are registered with default labels for service identity and instance.
  - Tenant scoping is applied per-metric via middleware and service code.
- HTTP metrics
  - Counters for requests by method/route/status/tenant.
  - Histograms for request/response sizes and durations.
  - Gauge for active connections.
- System metrics
  - Uptime, process start time, and memory usage gauges updated periodically.
- Embedding metrics
  - Requests, durations, errors, vector sizes, and batch sizes scoped by provider and tenant.
- Memory/Qdrant metrics
  - Store/update/delete operations and durations; query/upsert timing.
- Agent and MCP tool metrics
  - Tool invocation counts, durations, errors, input/output sizes; agent contribution and quality metrics.
- Anomaly metrics
  - Heuristic anomaly event counters with severity and type.

```mermaid
classDiagram
class Registry {
+setDefaultLabels()
}
class HttpMetrics {
+httpRequests
+httpRequestDuration
+httpRequestSize
+httpResponseSize
+httpActiveConnections
}
class SystemMetrics {
+systemUptime
+systemMemoryUsage
+systemProcessStartTime
}
class EmbeddingMetrics {
+embeddingRequests
+embeddingDuration
+embeddingErrors
+embeddingVectorSize
+embeddingBatchSize
}
class MemoryMetrics {
+memoryStore
+memoryStoreDuration
+memoryAdapterSize
}
class QdrantMetrics {
+qdrantOperations
+qdrantOperationDuration
+qdrantQueryDuration
+qdrantUpsertDuration
}
class AgentMetrics {
+agentContributions
+agentImplementationBonus
+agentRareSuccesses
+agentQualityScore
}
class McpMetrics {
+mcpToolCalls
+mcpToolDuration
+mcpToolErrors
+mcpToolInputSize
+mcpToolOutputSize
+kairosQualityUpdateErrors
+kairosTrainSimilarAdapterFound
}
class AnomalyMetrics {
+anomalyEvents
}
Registry <.. HttpMetrics : "registered"
Registry <.. SystemMetrics : "registered"
Registry <.. EmbeddingMetrics : "registered"
Registry <.. MemoryMetrics : "registered"
Registry <.. QdrantMetrics : "registered"
Registry <.. AgentMetrics : "registered"
Registry <.. McpMetrics : "registered"
Registry <.. AnomalyMetrics : "registered"
```

**Diagram sources**
- [registry.ts:11-18](file://src/services/metrics/registry.ts#L11-L18)
- [http-metrics.ts:11-47](file://src/services/metrics/http-metrics.ts#L11-L47)
- [system-metrics.ts:10-41](file://src/services/metrics/system-metrics.ts#L10-L41)
- [embedding-metrics.ts:11-39](file://src/services/metrics/embedding-metrics.ts#L11-L39)
- [memory-metrics.ts:11-32](file://src/services/metrics/memory-metrics.ts#L11-L32)
- [qdrant-metrics.ts:11-40](file://src/services/metrics/qdrant-metrics.ts#L11-L40)
- [agent-metrics.ts:12-39](file://src/services/metrics/agent-metrics.ts#L12-L39)
- [mcp-metrics.ts:11-63](file://src/services/metrics/mcp-metrics.ts#L11-L63)
- [anomaly-metrics.ts:4-9](file://src/services/metrics/anomaly-metrics.ts#L4-L9)

**Section sources**
- [registry.ts:11-18](file://src/services/metrics/registry.ts#L11-L18)
- [http-metrics.ts:11-47](file://src/services/metrics/http-metrics.ts#L11-L47)
- [system-metrics.ts:10-41](file://src/services/metrics/system-metrics.ts#L10-L41)
- [embedding-metrics.ts:11-39](file://src/services/metrics/embedding-metrics.ts#L11-L39)
- [memory-metrics.ts:11-32](file://src/services/metrics/memory-metrics.ts#L11-L32)
- [qdrant-metrics.ts:11-40](file://src/services/metrics/qdrant-metrics.ts#L11-L40)
- [agent-metrics.ts:12-39](file://src/services/metrics/agent-metrics.ts#L12-L39)
- [mcp-metrics.ts:11-63](file://src/services/metrics/mcp-metrics.ts#L11-L63)
- [anomaly-metrics.ts:4-9](file://src/services/metrics/anomaly-metrics.ts#L4-L9)

### Health Checks
- Service health
  - Probes Qdrant, Redis/cache, and embedding provider health.
  - Embedding health is bounded by a timeout to keep /health responsive.
  - Returns readiness status, version, uptime, and dependency details.
- Embedding health
  - Supports OpenAI and TEI with provider-specific checks and error classification (authentication, rate-limited, etc.).
- Qdrant service
  - Provides a facade around Qdrant operations; health checks leverage the underlying connection and collection management.

```mermaid
sequenceDiagram
participant Client as "Probe Client"
participant App as "HTTP App"
participant Q as "Qdrant Store"
participant KV as "Key-Value Store"
participant ES as "Embedding Service"
Client->>App : GET /health
App->>Q : checkHealth()
Q-->>App : boolean
App->>KV : isConnected()
KV-->>App : boolean
App->>ES : healthCheck() or teiHealthCheck()
ES-->>App : {healthy,message}
App-->>Client : 200/503 with dependencies and details
```

**Diagram sources**
- [http-health-routes.ts:14-89](file://src/http/http-health-routes.ts#L14-L89)
- [health.ts:16-119](file://src/services/embedding/health.ts#L16-L119)
- [service.ts:16-27](file://src/services/qdrant/service.ts#L16-L27)

**Section sources**
- [http-health-routes.ts:14-89](file://src/http/http-health-routes.ts#L14-L89)
- [health.ts:16-119](file://src/services/embedding/health.ts#L16-L119)
- [service.ts:16-27](file://src/services/qdrant/service.ts#L16-L27)

### Structured Logging System
- HTTP access logging
  - Captures method, path, protocol, client IP, user agent, request_id, status, and response time.
  - Uses a middleware to log start and completion events.
- Error tracking and audit events
  - Error logs include error_code and request_id when provided.
  - Audit events are sanitized and written to a configurable audit file stream.
- **MCP audit logging infrastructure**
  - **Configurable verbosity levels (0-3) controlled by AUDIT_LOG_LEVEL environment variable**.
  - **Optional dedicated audit file stream controlled by AUDIT_LOG_FILE environment variable**.
  - **Comprehensive audit event tracking for MCP tool calls, requests, and responses**.
  - **Correlation IDs for grouping related MCP requests across the system**.
- Transport and formatting
  - Supports JSON or text output with redaction of sensitive fields.
  - HTTP transport writes to stdout/stderr depending on configuration.

```mermaid
flowchart TD
Start(["HTTP Request"]) --> Bindings["Build start bindings<br/>method,path,client,request_id"]
Bindings --> LogStart["Log 'HTTP request received'"]
LogStart --> Process["Process request"]
Process --> Status{"Status >= 500?"}
Status --> |Yes| LevelErr["Level: error"]
Status --> |No| Status400{"Status >= 400?"}
Status400 --> |Yes| LevelWarn["Level: warn"]
Status400 --> |No| LevelInfo["Level: info"]
LevelErr --> Duration["Compute duration_ms"]
LevelWarn --> Duration
LevelInfo --> Duration
Duration --> FinishBindings["Build finish bindings<br/>status,response_time_ms,client"]
FinishBindings --> LogFinish["Log 'HTTP request completed'"]
LogFinish --> Audit["Maybe write audit line"]
Audit --> End(["Response sent"])
```

**Diagram sources**
- [structured-logger.ts:145-178](file://src/utils/structured-logger.ts#L145-L178)
- [structured-logger.ts:134-142](file://src/utils/structured-logger.ts#L134-L142)
- [log-core.ts:44-73](file://src/utils/log-core.ts#L44-L73)
- [mcp-audit-emit.ts:35-61](file://src/http/mcp-audit-emit.ts#L35-L61)

**Section sources**
- [structured-logger.ts:145-178](file://src/utils/structured-logger.ts#L145-L178)
- [structured-logger.ts:134-142](file://src/utils/structured-logger.ts#L134-L142)
- [log-core.ts:44-73](file://src/utils/log-core.ts#L44-L73)
- [mcp-audit-emit.ts:1-75](file://src/http/mcp-audit-emit.ts#L1-L75)
- [audit-log.md:30-35](file://docs/security/audit-log.md#L30-L35)

### MCP Audit Logging Infrastructure
**Updated** The MCP audit logging infrastructure provides comprehensive audit event tracking with configurable verbosity and optional file streaming.

- **Configuration Variables**
  - `AUDIT_LOG_FILE`: Optional path to dedicated audit file (append mode); empty disables audit file streaming.
  - `AUDIT_LOG_LEVEL`: Verbosity level (0-3) controlling MCP audit event detail.
- **Audit Event Types**
  - `mcp_request_start`: Emitted before space context resolution with correlation ID and unknown tenant.
  - `mcp_request_end`: Emitted on response completion with duration and correlation ID.
  - `mcp_tool_call`: Comprehensive tool call audit with request arguments, response summaries, and error codes.
- **Audit Event Fields**
  - `category`: Always `audit.mcp` for MCP audit events.
  - `correlation_id`: Unique identifier for grouping related requests.
  - `tenant_id`: Resolved from space context during tool execution.
  - `request_id`: MCP request identifier.
  - `mcp_method`: JSON-RPC method name.
  - `tool_name`: MCP tool being invoked.
  - `duration_ms`: Request processing time.
  - `server_version`: Build version for audit trail.
  - `request_args`: Summarized tool input arguments (level 2+).
  - `response`: Tool response summary (level 2+).
  - `error_code`: Error classification for failed requests (level 3+).
- **Verbosity Levels**
  - Level 0: Disable all MCP audit events.
  - Level 1: Basic request lifecycle events (`mcp_request_start`, `mcp_request_end`).
  - Level 2: Include tool call details with argument summaries.
  - Level 3: Include comprehensive response summaries and error details.
- **Audit File Streaming**
  - Optional append-only file stream for compliance and security requirements.
  - Separate from main structured log for dedicated audit trails.
  - File stream is opened at server startup if configured.

```mermaid
flowchart TD
Config["Audit Configuration<br/>AUDIT_LOG_LEVEL/AUDIT_LOG_FILE"] --> Handler["MCP Handler"]
Handler --> Start["emitRequestStart<br/>(mcp_request_start)"]
Start --> Context["Resolve Space Context"]
Context --> Tool["Execute Tool"]
Tool --> Response["Capture Response<br/>(if level >= 2)"]
Response --> End["emitRequestEnd<br/>(mcp_request_end)"]
Tool --> Call["emitToolCallAudit<br/>(mcp_tool_call)"]
Call --> File["Write to Audit File<br/>(if configured)"]
End --> Complete["Request Complete"]
```

**Diagram sources**
- [mcp-audit-emit.ts:18-27](file://src/http/mcp-audit-emit.ts#L18-L27)
- [mcp-audit-emit.ts:35-61](file://src/http/mcp-audit-emit.ts#L35-L61)
- [mcp-audit-emit.ts:67-75](file://src/http/mcp-audit-emit.ts#L67-L75)
- [http-mcp-handler.ts:123-125](file://src/http/http-mcp-handler.ts#L123-L125)
- [http-mcp-handler.ts:128](file://src/http/http-mcp-handler.ts#L128)
- [http-mcp-handler.ts:264-266](file://src/http/http-mcp-handler.ts#L264-L266)

**Section sources**
- [mcp-audit-emit.ts:1-75](file://src/http/mcp-audit-emit.ts#L1-L75)
- [http-mcp-handler.ts:123-125](file://src/http/http-mcp-handler.ts#L123-L125)
- [http-mcp-handler.ts:128](file://src/http/http-mcp-handler.ts#L128)
- [http-mcp-handler.ts:264-266](file://src/http/http-mcp-handler.ts#L264-L266)
- [audit-log.md:30-35](file://docs/security/audit-log.md#L30-L35)
- [config.ts:85-91](file://src/config.ts#L85-L91)

### Metrics Scraping, Alerting, and Dashboards
- Scraping
  - Scrape the dedicated metrics server's /metrics endpoint.
  - Ensure Prometheus targets scrape the metrics port and apply relabeling for service, version, and instance.
- Alerting
  - Use thresholds on HTTP error rates, latency SLOs, embedding provider availability, and Qdrant operation failures.
  - Monitor anomaly events and cache/backend connectivity.
  - **Monitor MCP audit infrastructure health (file stream availability, audit event rates)**.
- Dashboards
  - Build panels for:
    - HTTP request volume, error rates, and latency by method/route/status
    - Embedding provider usage and latency
    - Memory store/update/delete rates and durations
    - Qdrant operation latencies and error counters
    - System memory and uptime
    - Agent quality score distributions and contribution totals
    - **MCP tool call volumes, durations, and error rates by tool**
    - **Audit event rates and file stream health indicators**

## Dependency Analysis
- Coupling and cohesion
  - Metrics are cohesive per domain and registered centrally for consistent labeling.
  - HTTP middleware depends on tenant context and the registry; embedding and memory services increment metrics.
  - **MCP audit emitter depends on configuration module and structured logger**.
- External dependencies
  - Prometheus registry and client libraries
  - Qdrant client for vector operations
  - Embedding providers (OpenAI/TEI) for health checks
  - **Optional file system for audit log streaming**
- Health dependency chain
  - Application health depends on Qdrant, Redis/cache, and embedding provider health.
  - **MCP audit infrastructure depends on configuration availability and file system access**.

```mermaid
graph LR
Reg["Registry"] --> HM["HTTP Metrics"]
Reg --> SM["System Metrics"]
Reg --> EM["Embedding Metrics"]
Reg --> MM["Memory Metrics"]
Reg --> QM["Qdrant Metrics"]
Reg --> AM["Agent Metrics"]
Reg --> CM["MCP Metrics"]
Reg --> AN["Anomaly Metrics"]
MW["HTTP Metrics Middleware"] --> HM
HS["Health Routes"] --> Q["Qdrant Store"]
HS --> KV["Key-Value Store"]
HS --> ES["Embedding Service"]
AC["Audit Config"] --> AE["Audit Emitter"]
AE --> SL["Structured Logger"]
SL --> AF["Audit File Stream"]
```

**Diagram sources**
- [registry.ts:11-18](file://src/services/metrics/registry.ts#L11-L18)
- [http-metrics.ts:11-47](file://src/services/metrics/http-metrics.ts#L11-L47)
- [system-metrics.ts:10-41](file://src/services/metrics/system-metrics.ts#L10-L41)
- [embedding-metrics.ts:11-39](file://src/services/metrics/embedding-metrics.ts#L11-L39)
- [memory-metrics.ts:11-32](file://src/services/metrics/memory-metrics.ts#L11-L32)
- [qdrant-metrics.ts:11-40](file://src/services/metrics/qdrant-metrics.ts#L11-L40)
- [agent-metrics.ts:12-39](file://src/services/metrics/agent-metrics.ts#L12-L39)
- [mcp-metrics.ts:11-63](file://src/services/metrics/mcp-metrics.ts#L11-L63)
- [anomaly-metrics.ts:4-9](file://src/services/metrics/anomaly-metrics.ts#L4-L9)
- [http-health-routes.ts:14-89](file://src/http/http-health-routes.ts#L14-L89)
- [mcp-audit-emit.ts:10-14](file://src/http/mcp-audit-emit.ts#L10-L14)
- [structured-logger.ts:46-48](file://src/utils/structured-logger.ts#L46-L48)
- [config.ts:85-91](file://src/config.ts#L85-L91)

**Section sources**
- [http-health-routes.ts:14-89](file://src/http/http-health-routes.ts#L14-L89)
- [mcp-audit-emit.ts:1-75](file://src/http/mcp-audit-emit.ts#L1-L75)
- [structured-logger.ts:46-48](file://src/utils/structured-logger.ts#L46-L48)
- [config.ts:85-91](file://src/config.ts#L85-L91)

## Performance Considerations
- Metrics overhead
  - Use histograms with appropriate buckets to balance fidelity and cardinality.
  - Avoid excessive label cardinality; prefer tenant_id scoping where necessary.
- Logging throughput
  - JSON formatting and redaction are efficient; ensure audit stream does not block request path.
  - **MCP audit events are conditional based on AUDIT_LOG_LEVEL, minimizing overhead when disabled**.
- Health checks
  - Embedding health checks are bounded by timeouts to prevent blocking readiness.
- System metrics
  - Periodic updates are lightweight; ensure intervals align with scraping cadence.
- **Audit infrastructure performance**
  - **File I/O operations are minimized through append-only streaming and conditional event emission**.
  - **Response capture only occurs when AUDIT_LOG_LEVEL >= 2, avoiding unnecessary serialization overhead**.

## Troubleshooting Guide
- Metrics not appearing in Prometheus
  - Verify the metrics server is running and exposing /metrics.
  - Confirm the registry content type and that scraping target matches the port.
- High HTTP error rates
  - Inspect HTTP metrics by status and route; correlate with embedding provider errors.
- Embedding provider issues
  - Check embedding health endpoint and provider configuration; watch for rate limits or authentication failures.
- Qdrant connectivity
  - Review Qdrant operation metrics and durations; confirm collection existence and permissions.
- Audit logs not written
  - Validate audit file path and permissions; ensure sanitization does not truncate records unexpectedly.
  - **Check AUDIT_LOG_FILE configuration and verify file system write permissions**.
  - **Verify AUDIT_LOG_LEVEL is set appropriately (1-3 for MCP audit events)**.
  - **Monitor audit file stream health and ensure it remains open during server runtime**.
- **MCP audit event issues**
  - **Confirm AUDIT_LOG_LEVEL is set to enable MCP audit events (levels 1-3)**.
  - **Verify correlation IDs are being generated and associated with audit events**.
  - **Check that tenant context is resolving correctly for MCP tool call audits**.

**Section sources**
- [metrics-server.ts:23-32](file://src/metrics-server.ts#L23-L32)
- [http-health-routes.ts:14-89](file://src/http/http-health-routes.ts#L14-L89)
- [health.ts:16-119](file://src/services/embedding/health.ts#L16-L119)
- [structured-logger.ts:134-142](file://src/utils/structured-logger.ts#L134-L142)
- [mcp-audit-emit.ts:35-61](file://src/http/mcp-audit-emit.ts#L35-L61)
- [audit-log.md:30-35](file://docs/security/audit-log.md#L30-L35)

## Conclusion
KAIROS MCP provides a comprehensive observability foundation with Prometheus-compatible metrics, structured logging, and health checks. **The new MCP audit logging infrastructure enhances security and compliance capabilities with configurable verbosity levels and optional dedicated audit file streaming.** By leveraging the dedicated metrics server, HTTP middleware, centralized registry, and MCP audit infrastructure, operators can monitor performance, troubleshoot issues, maintain service reliability, and meet audit requirements. Align alerting and dashboards with the metric families and audit event categories described to achieve operational excellence.

## Appendices

### Best Practices
- Labeling
  - Scope tenant_id per-metric for tenant isolation.
  - Limit label cardinality to avoid memory growth.
- Alerting
  - Define SLOs for HTTP latency and error rates.
  - Monitor embedding provider health and Qdrant operation latencies.
  - **Monitor MCP audit infrastructure health and audit event rates**.
- Logging
  - Redact sensitive fields; ensure audit streams do not degrade performance.
  - **Configure AUDIT_LOG_LEVEL appropriately for your compliance requirements**.
  - **Use AUDIT_LOG_FILE for regulatory compliance and security investigations**.
- Scraping
  - Separate metrics port from application traffic; restrict access to internal networks.
- **MCP Audit Configuration**
  - **Set AUDIT_LOG_LEVEL=1 for basic audit event tracking, 2 for tool call details, 3 for comprehensive auditing**.
  - **Configure AUDIT_LOG_FILE for compliance requirements and security monitoring**.
  - **Monitor audit file stream health and ensure continuous write capability**.