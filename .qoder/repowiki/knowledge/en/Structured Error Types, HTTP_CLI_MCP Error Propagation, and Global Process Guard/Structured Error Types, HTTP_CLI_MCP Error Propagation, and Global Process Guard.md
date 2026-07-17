---
kind: error_handling
name: Structured Error Types, HTTP/CLI/MCP Error Propagation, and Global Process Guards
category: error_handling
scope:
    - '**'
source_files:
    - src/types/index.ts
    - src/cli/auth-error.ts
    - src/services/embedding/providers.ts
    - src/http/http-route-errors.ts
    - src/http/http-error-handlers.ts
    - src/tools/forward-tool-error.ts
    - src/tools/mcp-runtime-error.ts
    - src/utils/global-error-handlers.ts
---

The KAIROS MCP Server uses a layered error-handling strategy that distinguishes between domain errors, transport-specific failures (HTTP, CLI, MCP), and process-level safety nets. Errors are typed, carry machine-readable codes, and are normalized at each boundary before being surfaced to the caller.

### 1. Core domain error type
- `KairosError` (`src/types/index.ts`) is the canonical application error: it extends `Error`, carries a stable string `code`, an HTTP-like `statusCode`, and an optional `details` object for structured context. Route handlers and services throw this to signal business-rule violations (e.g. `INVALID_SLUG`, `DUPLICATE_ADAPTER`, `MEMORY_NOT_FOUND`, `QDRANT_UNAVAILABLE`).

### 2. Transport-specific error classes
- **CLI auth**: `AuthRequiredError` (`src/cli/auth-error.ts`) augments `Error` with a `loginUrl`. The CLI's `handleApiError` prints a user-friendly message (without the generic `Error:` prefix) and optionally opens the login URL in a browser; it then calls `process.exit(1)`.
- **Embedding provider rate limits**: `EmbeddingRateLimitError` (`src/services/embedding/providers.ts`) captures provider, HTTP status, and a code such as `insufficient_quota`. It is thrown when OpenAI returns 429 with a non-retriable quota error or after retries are exhausted.
- **Training tooling**: `TrainError` (`src/tools/train-store.ts`) is another domain subclass used by training-related flows.

### 3. HTTP layer normalization
- `sendToolRouteError` (`src/http/http-route-errors.ts`) converts any thrown error into a JSON response: it reads `status`/`statusCode` from the error (or defaults to 500), maps `KairosError.code` into the `error` field, attaches `message`, and spreads `details`. Unknown errors fall back to a provided `fallbackErrorCode`.
- A global Express `ErrorRequestHandler` (`src/http/http-error-handlers.ts`) catches unhandled exceptions, logs via `structuredLogger`, responds with `PAYLOAD_TOO_LARGE` for 413s, and otherwise returns `500 Internal server error`. A catch-all 404 handler and a `/mcp` GET rejection (405) are also registered here.

### 4. MCP tool-layer formatting
- `formatForwardToolError` (`src/tools/forward-tool-error.ts`) turns a `KairosError` into the `{ error, error_code, message, ...details }` shape expected by MCP tool callers.
- `mcpRateLimitErrorResult` (`src/tools/mcp-runtime-error.ts`) intercepts `EmbeddingRateLimitError` and returns a structured MCP error payload (`EMBEDDING_RATE_LIMIT`) so clients can parse actionable guidance instead of receiving a raw text string.

### 5. Process-wide safety nets
- `installGlobalErrorHandlers` (`src/utils/global-error-handlers.ts`) registers listeners for `uncaughtException`, `unhandledRejection`, `rejectionHandled`, `multipleResolves`, and Node `warning` events. All are forwarded to the structured logger; `uncaughtException` sets `process.exitCode = 1` without exiting immediately, letting a supervisor decide termination.

### 6. Conventions developers should follow
- Prefer throwing `KairosError` with a stable `code` and appropriate `statusCode`; include extra context in `details` rather than overloading the message.
- For external service failures that need special client handling (rate limits, auth), define a dedicated `extends Error` class (see `EmbeddingRateLimitError`, `AuthRequiredError`) and handle it at the nearest transport boundary.
- In HTTP route handlers, either return early with `res.status(...).json(...)` for known cases or throw `KairosError` and let `sendToolRouteError` normalize it.
- In MCP tool implementations, wrap provider errors with `mcpRateLimitErrorResult` / `formatForwardToolError` so the JSON-RPC envelope stays valid and clients receive structured guidance.
- Never swallow errors silently — always log via `structuredLogger` before returning or rethrowing.
- Rely on the global handlers for unexpected crashes; do not install additional top-level try/catch blocks unless you are translating to a transport-specific format.