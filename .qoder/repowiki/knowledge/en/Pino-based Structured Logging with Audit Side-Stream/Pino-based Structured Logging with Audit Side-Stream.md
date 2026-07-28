---
kind: logging_system
name: Pino-based Structured Logging with Audit Side-Stream
category: logging_system
scope:
    - '**'
source_files:
    - src/utils/structured-logger.ts
    - src/utils/log-core.ts
    - docs/architecture/logging.md
    - src/config.ts
---

## What system/approach is used

KAIROS uses **Pino** as its structured logging backend. A thin wrapper (`src/utils/structured-logger.ts`) exposes a single `structuredLogger` (alias `logger`) API consumed across HTTP handlers, MCP tooling, services, and the CLI. The Pino instance is created once in `src/utils/log-core.ts` and configured from environment variables. An optional **audit side-stream** writes sanitized JSON lines to a separate file when `AUDIT_LOG_FILE` is set.

## Key files and packages

- `src/utils/log-core.ts` — singleton Pino factory; redaction paths, serializers for Express req/res, text vs JSON sink selection based on `LOG_FORMAT` / `TRANSPORT_TYPE`.
- `src/utils/structured-logger.ts` — public logger surface: `debug/info/warn/error`, `tool()`, `success()`, `requestTimeout()`, `child()`, `getTransportType()`, `getLogFormat()`, `getPinoLogger()`, plus the `httpLogger` Express middleware and `writeAuditLine()` audit writer.
- `docs/architecture/logging.md` — canonical developer guide covering levels, standard fields, usage patterns, env vars, and sample output.
- `src/config.ts` — centralizes `LOG_LEVEL`, `LOG_FORMAT`, `TRANSPORT_TYPE`, `AUDIT_LOG_FILE`, `AUDIT_LOG_LEVEL`, `TRUSTED_PROXY_CIDRS`.

## Architecture and conventions

### Logger lifecycle
1. `log-core.ts` creates a single `pino.Logger` via `getBaseLogger()`, applying:
   - Level from `LOG_LEVEL` (default `info`).
   - ISO timestamps via `pino.stdTimeFunctions.isoTime`.
   - Redaction of sensitive paths (`authorization`, `password`, `secret`, `cookie`, `set-cookie`).
   - Custom serializers that strip full headers off Express req/res objects.
2. `structured-logger.ts` wraps this base logger, adding:
   - Sanitization of all free-form messages and binding keys/values before they reach any sink.
   - Optional audit file stream (`AUDIT_LOG_FILE`) with depth/key/string limits and safe serialization.
   - HTTP access middleware (`httpLogger`) that injects `request_id`, `client_ip` (proxy-aware via `TRUSTED_PROXY_CIDRS`), `user_agent`, `method`, `path`, `status`, `response_time_ms`.
   - Convenience helpers: `tool(toolName, operation, details)`, `success(operation, details)`, `requestTimeout(operation, timeoutMs)`.

### Log levels and semantics
| Level | Guidance |
|-------|----------|
| `trace` | Very verbose diagnostics; off by default in production. |
| `debug` | Developer detail; emitted only when `LOG_LEVEL=debug` or `trace`. |
| `info` | Normal operations: request start/complete, tool calls, startup, success outcomes. |
| `warn` | Recoverable issues: validation failures, retries, client cancellations, 4xx responses. |
| `error` | Failures/unexpected conditions: 5xx, exceptions, timeouts; include `error_code` and `request_id` when available. |

### Standard fields
Logs should include where relevant: `timestamp`, `level`, `msg`, `request_id`/`correlation_id`, `duration_ms`, `status`/`code`, `component`/`module`, `operation`, `error_code`, `client_ip`, `user_agent`. Use child loggers (`structuredLogger.child({ component, module })`) to attach context.

### Sinks and transport routing
- `LOG_FORMAT=text`: Pino emits one JSON line per record; a custom Writable rewrites it to `[HH:mm:ss] [LEVEL] msg` and writes to `stderr` (stdio mode) or `stdout` (http mode).
- `LOG_FORMAT=json`: raw Pino JSON lines go directly to `stderr` (stdio) or `stdout` (http).
- `TRANSPORT_TYPE=http` → logs to stdout; `TRANSPORT_TYPE=stdio` → logs to stderr.

### Audit logging
When `AUDIT_LOG_FILE` is set, every `info`/`warn`/`error` call is also written to the audit file through `maybeWriteAuditLine`, after sanitizing bindings (max depth 4, max 40 keys, string length caps, CR/LF neutralization). Modules outside the logger can call `writeAuditLine(level, bindings)` directly.

### Error codes
Tool/API errors use stable `error_code` values (e.g. `NONCE_MISMATCH`, `TYPE_MISMATCH`, `MAX_RETRIES_EXCEEDED`, `MISSING_PROOF`, `MISSING_FIELD`) and should be included in error log payloads for monitoring and retry logic.

## Rules developers should follow

1. **Always import from `src/utils/structured-logger.ts`** — never call `console.log` or instantiate Pino directly.
2. **Use the correct level** — do not prefix messages with `"DEBUG:"` / `"ERROR:"`; rely on the level field.
3. **Attach structured fields** — include `operation`, `error_code`, `request_id`, `component`/`module` where applicable; prefer child loggers for component context.
4. **Never log secrets** — auth headers, cookies, tokens are redacted automatically, but avoid passing them in bindings.
5. **Include `error_code` on errors** — machine-readable codes enable automated alerting and agent retry.
6. **Use `httpLogger` middleware** for new HTTP routes so `request_id`, `client_ip`, `response_time_ms` are captured consistently.
7. **Control verbosity via env** — set `LOG_LEVEL`, `LOG_FORMAT`, `TRANSPORT_TYPE`, `AUDIT_LOG_FILE`, `AUDIT_LOG_LEVEL`, `TRUSTED_PROXY_CIDRS` rather than code changes.