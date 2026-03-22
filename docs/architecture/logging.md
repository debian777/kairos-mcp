# KAIROS MCP — Logging

KAIROS uses [Pino](https://github.com/pinojs/pino) for structured logging.
This document covers log levels, standard fields, how to use the logger in
code, and environment variables for production monitoring and debugging.

## Log levels

| Level     | Use for |
|-----------|---------|
| **trace** | Very verbose, high-volume diagnostics (for example, per-item loops). Off by default in production. |
| **debug** | Developer detail: parameters, internal state, non-normal paths. Emitted only when `LOG_LEVEL=debug` or `trace`. Do not prefix messages with "DEBUG:"; use the level. |
| **info**  | Normal operations: request start/complete, tool calls, startup, successful outcomes. Default for production. |
| **warn**  | Recoverable or expected issues: validation failures, retries, client cancellations, 4xx responses. |
| **error** | Failures and unexpected conditions: 5xx, exceptions, timeouts. Always include `request_id` and `error_code` when available. |

Use the correct level. Never prefix messages with "DEBUG:" or "ERROR:".

## Standard fields

Include these fields where relevant so log lines support monitoring and
aggregation.

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 (for example, `2025-02-26T12:00:00.000Z`). Added automatically. |
| `level` | `trace` \| `debug` \| `info` \| `warn` \| `error`. |
| `msg` | Human-readable message (required by Pino). |
| `request_id` / `correlation_id` | Request or correlation ID for tracing. Set by HTTP middleware or caller. |
| `duration_ms` | Elapsed time in milliseconds. |
| `status` / `code` | HTTP status or application code. |
| `component` / `module` | Logger component name (for example, `qdrant`, `proof-of-work-store`). Use child loggers. |
| `operation` | Operation or tool name (for example, `forward`, `search`). |
| `error_code` | Machine-readable error code (for example, `NONCE_MISMATCH`). Preserved for agent retry and monitoring. |
| `client_ip` | Client IP (HTTP). Set by middleware; proxy-safe when `TRUSTED_PROXY_CIDRS` is configured. |
| `user_agent` | Client user-agent (redacted if sensitive). |

**Safety:** Never log secrets. Auth headers, cookies, and tokens are
redacted by the logger. Avoid PII in free-form messages.

## Which logger to use

There is a single logger surface: **`structuredLogger`** from
`src/utils/structured-logger.ts`. **`logger`** is an alias for it (same
module). Use `structuredLogger` for HTTP/MCP request flow and when you need
`child()` for component context or `error(..., { error_code, request_id })`.
Using `logger` is valid everywhere (e.g. services, Qdrant, Redis,
proof-of-work, memory). Both names refer to the same Pino backend.

Prefer one name per file for consistency; use child loggers to add
`component` or `module`.

## Using the logger in code

```ts
import { structuredLogger } from '../utils/structured-logger.js';

// Simple message
structuredLogger.info('Server started');

// With structured fields
structuredLogger.info(
  { operation: 'forward', duration_ms: 42, request_id },
  'Step advanced'
);

// Error with error_code for monitoring and retry
structuredLogger.error(
  { error_code: 'NONCE_MISMATCH', request_id },
  'Nonce mismatch',
  error
);

// Child logger for component
const log = structuredLogger.child({ component: 'qdrant', module: 'search' });
log.debug({ collection, limit }, 'Search params');
log.info({ duration_ms, result_count }, 'Search completed');
```

```ts
import { logger } from '../utils/structured-logger.js';

logger.info('Redis connected');
logger.debug('Cache key hit');  // emitted only when LOG_LEVEL=debug
logger.error('Proof store failed', err);
logger.tool('reward', 'rate', `rated ${uri}`);
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum level: `trace`, `debug`, `info`, `warn`, `error`. |
| `LOG_FORMAT` | `text` | `text` (human-readable) or `json` (one JSON object per line). |
| `TRANSPORT_TYPE` | `stdio` | Log-stream routing hint used by the logger: `stdio` sends text logs to stderr, `http` sends text logs to stdout. The application runtime itself is HTTP-only; this variable does not enable a second MCP transport. |
| `TRUSTED_PROXY_CIDRS` | (empty) | Comma-separated CIDRs for proxy-safe client IP from `X-Forwarded-For`. |

See [install/](../install/) for env examples. All env vars and defaults are in
[`src/config.ts`](../../src/config.ts).

## HTTP and MCP traffic

- **HTTP:** `httpLogger` middleware logs each request with `method`,
  `path`, `status`, `response_time_ms`, `request_id`, `client_ip`, and
  `user_agent`. The middleware generates a request ID when the client
  does not send `X-Request-Id`.
- **MCP:** The handler logs request start/complete, timeouts,
  cancellations, and errors with `request_id` (from the request body
  `id`) and the tool name where available.

## Error codes (tools)

Tool and API error responses use stable `error_code` values. Include
`error_code` in the log payload when logging these errors.

- `NONCE_MISMATCH` — solution used wrong nonce
- `TYPE_MISMATCH` — solution type does not match challenge type
- `MAX_RETRIES_EXCEEDED` — retry limit reached
- `MISSING_PROOF` — previous step proof missing or invalid
- `MISSING_FIELD` — required field missing

See [workflow-forward-continue.md](workflow-forward-continue.md)
for the full error code list.

## Verifying

```bash
# Enable JSON logs and debug level, then deploy
LOG_LEVEL=debug LOG_FORMAT=json TRANSPORT_TYPE=http npm run dev:deploy

# Trigger a few MCP or HTTP requests and inspect output
# (one JSON object per line)
```

Sample JSON log line:

```json
{
  "level": 30,
  "time": "2025-02-26T12:00:00.000Z",
  "request_id": "req-123",
  "http": { "method": "POST", "path": "/mcp" },
  "status": 200,
  "response_time_ms": 45,
  "client": { "ip": "127.0.0.1" },
  "msg": "POST /mcp -> 200"
}
```
