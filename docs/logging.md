# KAIROS MCP — Logging

This document describes log levels, standard fields, how to use the logger in code, and environment variables for production-ready monitoring, traffic tracking, error tracking, and debugging.

## Log levels

| Level   | Use for |
|--------|---------|
| **trace** | Very verbose, high-volume diagnostics (e.g. per-item loops). Usually off in production. |
| **debug** | Developer/diagnostic detail: parameters, internal state, non-normal paths. Emitted only when `LOG_LEVEL=debug` (or `trace`). Do not put "DEBUG:" in messages; use the level. |
| **info**  | Normal operations and traffic: request start/complete, tool calls, startup, successful outcomes. Default for production. |
| **warn**  | Recoverable or expected issues: validation failures, retries, client cancellations, 4xx responses. |
| **error** | Failures and unexpected conditions: 5xx, exceptions, timeouts. Always include context (e.g. `request_id`, `error_code`) when available. |

Rule: use the correct level instead of prefixing messages with "DEBUG:" or "ERROR:".

## Standard fields

Every log line should support monitoring and aggregation. Use these fields where relevant:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 (e.g. `2025-02-26T12:00:00.000Z`). Added automatically. |
| `level` | `trace` \| `debug` \| `info` \| `warn` \| `error`. |
| `msg` | Human-readable message (required by Pino). |
| `request_id` / `correlation_id` | Request or correlation ID for tracing. Set by HTTP middleware or caller. |
| `duration_ms` | Elapsed time in milliseconds for the operation. |
| `status` / `code` | HTTP status or application code. |
| `component` / `module` | Logger component or module name (e.g. `qdrant`, `proof-of-work-store`). Use child loggers. |
| `operation` | Operation or tool name (e.g. `kairos_next`, `search`). |
| `error_code` | Machine-readable error code (e.g. `NONCE_MISMATCH`, `TYPE_MISMATCH`, `MAX_RETRIES_EXCEEDED`). Preserved for agent retry and monitoring. |
| `client_ip` | Client IP (HTTP). Set by middleware; proxy-safe when `TRUSTED_PROXY_CIDRS` is configured. |
| `user_agent` | Client user-agent (redacted if sensitive). |

**Safety:** Do not log secrets. Auth headers, cookies, and tokens are redacted by the logger. Avoid putting PII in free-form messages when avoidable.

## Which logger to use

- **`structuredLogger`** (from `src/utils/structured-logger.ts`): Use for HTTP/MCP request flow, HTTP middleware, and any code that already uses it. Supports `child()` for component context and `error(..., { error_code, request_id })`.
- **`logger`** (from `src/utils/logger.ts`): Same underlying Pino backend; use for services (Qdrant, Redis, proof-of-work, memory, tools that currently use `logger`). Same structured shape in JSON format.

Both loggers emit the **same structured shape** when `LOG_FORMAT=json`. Prefer one per file for consistency; use child loggers to add `component`/`module`.

## Using the logger in code

```ts
import { structuredLogger } from '../utils/structured-logger.js';

// Simple
structuredLogger.info('Server started');

// With context (structured fields)
structuredLogger.info({ operation: 'kairos_next', duration_ms: 42, request_id }, 'Step advanced');

// Errors with error_code for monitoring/retry
structuredLogger.error({ error_code: 'NONCE_MISMATCH', request_id }, 'Nonce mismatch', error);

// Child logger for component
const log = structuredLogger.child({ component: 'qdrant', module: 'search' });
log.debug({ collection, limit }, 'Search params');
log.info({ duration_ms, result_count }, 'Search completed');
```

```ts
import { logger } from '../utils/logger.js';

// logger uses same Pino backend; same fields in JSON
logger.info('Redis connected');
logger.debug('Cache key hit');  // only when LOG_LEVEL=debug
logger.error('Proof store failed', err);
logger.tool('kairos_attest', 'rate', `rated ${uri}`);
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum level: `trace`, `debug`, `info`, `warn`, `error`. |
| `LOG_FORMAT` | `text` | `text` (human-readable) or `json` (one JSON object per line for aggregation). |
| `TRANSPORT_TYPE` | `stdio` | `stdio` (logs to stderr; stdout reserved for MCP) or `http` (logs to stdout). |
| `TRUSTED_PROXY_CIDRS` | (empty) | Comma-separated CIDRs for proxy-safe client IP from `X-Forwarded-For`. |

See `env.example.txt` for full context.

## HTTP and MCP traffic

- **HTTP:** `httpLogger` middleware logs each request with `method`, `path`, `status`, `response_time_ms`, `request_id`, `client_ip`, `user_agent`. Request ID is generated if the client does not send `X-Request-Id`.
- **MCP:** Handler logs request start/complete, timeouts, cancellations, and errors with `request_id` (from request body `id`) and tool name where available.

## Error codes (tools)

Tool and API error responses use stable `error_code` values for monitoring and agent retry. When logging these errors, include `error_code` in the log payload:

- `NONCE_MISMATCH` — solution used wrong nonce
- `TYPE_MISMATCH` — solution type does not match challenge type
- `MAX_RETRIES_EXCEEDED` — retry limit reached
- `MISSING_PROOF` — previous step proof missing or invalid
- `MISSING_FIELD` — required field missing

## Verifying

```bash
# JSON logs (for aggregation)
LOG_LEVEL=debug LOG_FORMAT=json npm run dev

# Then trigger a few MCP/HTTP requests and inspect log lines (one JSON object per line).
```

Sample JSON log line:

```json
{"level":30,"time":"2025-02-26T12:00:00.000Z","request_id":"req-123","http":{"method":"POST","path":"/mcp"},"status":200,"response_time_ms":45,"client":{"ip":"127.0.0.1"},"msg":"POST /mcp -> 200"}
```
