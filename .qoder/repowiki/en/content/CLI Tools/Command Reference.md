# Command Reference

<cite>
**Referenced Files in This Document**
- [program.ts](file://src/cli/program.ts)
- [index.ts](file://src/cli/index.ts)
- [begin.ts](file://src/cli/commands/begin.ts)
- [attest.ts](file://src/cli/commands/attest.ts)
- [delete.ts](file://src/cli/commands/delete.ts)
- [export.ts](file://src/cli/commands/export.ts)
- [login.ts](file://src/cli/commands/login.ts)
- [logout.ts](file://src/cli/commands/logout.ts)
- [search.ts](file://src/cli/commands/search.ts)
- [serve.ts](file://src/cli/commands/serve.ts)
- [spaces.ts](file://src/cli/commands/spaces.ts)
- [token.ts](file://src/cli/commands/token.ts)
- [update.ts](file://src/cli/commands/update.ts)
- [config-file.ts](file://src/cli/config-file.ts)
- [oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [auth-error.ts](file://src/cli/auth-error.ts)
- [output.ts](file://src/cli/output.ts)
- [resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
- [rewrite-login-url.ts](file://src/cli/rewrite-login-url.ts)
- [safe-http-url.ts](file://src/cli/safe-http-url.ts)
- [http-auth-callback.ts](file://src/http/http-auth-callback.ts)
- [http-auth-oidc-redirect.ts](file://src/http/http-auth-oidc-redirect.ts)
- [http-auth-middleware.ts](file://src/http/http-auth-middleware.ts)
- [bearer-validate.ts](file://src/http/bearer-validate.ts)
</cite>

## Update Summary
**Changes Made**
- Enhanced timeout protection for authentication flows (login, logout, token commands)
- Improved reliability for forward command operations that previously experienced hanging behavior
- Added comprehensive timeout configuration options across all CLI commands
- Updated error handling for network timeouts and authentication flow failures

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
This document provides a comprehensive command reference for the Kairos MCP CLI. It covers all commands including begin, attest, delete, export, login, logout, search, serve, spaces, token, and update. For each command, you will find detailed syntax, required and optional parameters, environment variables, usage examples, command chaining patterns, output formatting options, and error handling guidance. Authentication-related commands (login, logout, token) include OIDC flow details with enhanced timeout protection. Data management commands (begin, delete, export) explain workflow lifecycle operations. Administrative commands (serve, spaces) cover server management and workspace operations.

**Updated** Enhanced timeout protection and improved reliability for authentication flows, particularly affecting login, logout, and forward commands that previously experienced hanging behavior.

## Project Structure
The CLI is implemented under src/cli with a program entry point that registers commands and shared configuration. Each command has its own file under src/cli/commands. Shared utilities handle authentication, configuration, HTTP client setup, and output formatting with enhanced timeout protection.

```mermaid
graph TB
A["CLI Entry<br/>src/cli/index.ts"] --> B["Program Setup<br/>src/cli/program.ts"]
B --> C1["Command: begin<br/>src/cli/commands/begin.ts"]
B --> C2["Command: attest<br/>src/cli/commands/attest.ts"]
B --> C3["Command: delete<br/>src/cli/commands/delete.ts"]
B --> C4["Command: export<br/>src/cli/commands/export.ts"]
B --> C5["Command: login<br/>src/cli/commands/login.ts"]
B --> C6["Command: logout<br/>src/cli/commands/logout.ts"]
B --> C7["Command: search<br/>src/cli/commands/search.ts"]
B --> C8["Command: serve<br/>src/cli/commands/serve.ts"]
B --> C9["Command: spaces<br/>src/cli/commands/spaces.ts"]
B --> C10["Command: token<br/>src/cli/commands/token.ts"]
B --> C11["Command: update<br/>src/cli/commands/update.ts"]
B --> D1["Config File<br/>src/cli/config-file.ts"]
B --> D2["OAuth Refresh<br/>src/cli/oauth-refresh.ts"]
B --> D3["Auth Error<br/>src/cli/auth-error.ts"]
B --> D4["Output Formatting<br/>src/cli/output.ts"]
B --> D5["Resolve API Base<br/>src/cli/resolve-api-base.ts"]
B --> D6["Rewrite Login URL<br/>src/cli/rewrite-login-url.ts"]
B --> D7["Safe HTTP URL<br/>src/cli/safe-http-url.ts"]
B --> D8["Timeout Protection<br/>Enhanced HTTP Client"]
```

**Diagram sources**
- [index.ts](file://src/cli/index.ts)
- [program.ts](file://src/cli/program.ts)
- [begin.ts](file://src/cli/commands/begin.ts)
- [attest.ts](file://src/cli/commands/attest.ts)
- [delete.ts](file://src/cli/commands/delete.ts)
- [export.ts](file://src/cli/commands/export.ts)
- [login.ts](file://src/cli/commands/login.ts)
- [logout.ts](file://src/cli/commands/logout.ts)
- [search.ts](file://src/cli/commands/search.ts)
- [serve.ts](file://src/cli/commands/serve.ts)
- [spaces.ts](file://src/cli/commands/spaces.ts)
- [token.ts](file://src/cli/commands/token.ts)
- [update.ts](file://src/cli/commands/update.ts)
- [config-file.ts](file://src/cli/config-file.ts)
- [oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [auth-error.ts](file://src/cli/auth-error.ts)
- [output.ts](file://src/cli/output.ts)
- [resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
- [rewrite-login-url.ts](file://src/cli/rewrite-login-url.ts)
- [safe-http-url.ts](file://src/cli/safe-http-url.ts)

**Section sources**
- [index.ts](file://src/cli/index.ts)
- [program.ts](file://src/cli/program.ts)

## Core Components
- Program bootstrap and command registration: The CLI entry initializes the program, sets up global options, and registers all subcommands with enhanced timeout protection.
- Configuration management: Reads and writes user configuration files, resolves API base URLs, and manages OIDC settings with timeout configurations.
- Authentication helpers: Handles OAuth refresh flows, rewrites login URLs, validates safe HTTP URLs, and formats auth errors with improved reliability.
- Output formatting: Provides consistent output modes (text, JSON, table) and structured logging for commands.
- Timeout protection: Implements comprehensive timeout handling for all HTTP requests and authentication flows to prevent hanging behavior.

Key responsibilities by module:
- Program setup and routing with timeout configuration
- Per-command argument parsing and validation
- Shared HTTP client and bearer token handling with timeout protection
- OIDC interactive login and callback handling with enhanced reliability
- Workspace and space listing/filtering
- Export pipeline orchestration and artifact bundling
- Server mode startup and health endpoints

**Updated** Enhanced timeout protection prevents authentication flows from hanging indefinitely and improves overall command reliability.

**Section sources**
- [program.ts](file://src/cli/program.ts)
- [config-file.ts](file://src/cli/config-file.ts)
- [oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [auth-error.ts](file://src/cli/auth-error.ts)
- [output.ts](file://src/cli/output.ts)
- [resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
- [rewrite-login-url.ts](file://src/cli/rewrite-login-url.ts)
- [safe-http-url.ts](file://src/cli/safe-http-url.ts)

## Architecture Overview
The CLI interacts with the Kairos server via HTTP with enhanced timeout protection. Authentication uses OpenID Connect (OIDC) with improved reliability. Commands may require an active session or a bearer token. Some commands can run locally (e.g., export assembly), while others call server APIs (e.g., begin, attest, search, spaces). All operations now include comprehensive timeout handling to prevent hanging behavior.

```mermaid
sequenceDiagram
participant User as "User"
participant CLI as "Kairos CLI"
participant Auth as "OIDC Provider"
participant Server as "Kairos Server"
User->>CLI : kairos login
CLI->>Auth : Open browser to authorization URL
Note over CLI : Enhanced timeout protection active
Auth-->>CLI : Redirect with code to local callback
CLI->>Auth : Exchange code for tokens
Note over CLI : Timeout protection prevents hanging
Auth-->>CLI : Access token + refresh token
CLI->>CLI : Persist tokens to config
CLI-->>User : Login successful
User->>CLI : kairos <command> [options]
Note over CLI : Global timeout configuration applied
CLI->>Server : HTTP request with bearer token and timeout
Server-->>CLI : Response (data, status)
CLI-->>User : Formatted output
```

**Updated** Enhanced timeout protection ensures authentication flows complete reliably without hanging behavior.

**Diagram sources**
- [login.ts](file://src/cli/commands/login.ts)
- [http-auth-callback.ts](file://src/http/http-auth-callback.ts)
- [http-auth-oidc-redirect.ts](file://src/http/http-auth-oidc-redirect.ts)
- [bearer-validate.ts](file://src/http/bearer-validate.ts)

## Detailed Component Analysis

### Global Options and Environment Variables
Commonly used across commands with enhanced timeout support:
- --api-base or KAIROS_API_BASE: Override default API base URL.
- --space or KAIROS_SPACE: Target workspace or space path.
- --format or KAIROS_OUTPUT_FORMAT: Control output format (text, json, table).
- --verbose or KAIROS_LOG_LEVEL: Increase log verbosity.
- --timeout or KAIROS_HTTP_TIMEOUT: HTTP request timeout (enhanced with better defaults).
- --no-color or NO_COLOR: Disable colored output.

Environment variable precedence typically follows: explicit flags > env vars > config file defaults.

**Updated** Enhanced timeout configuration with improved defaults and better error reporting for timeout scenarios.

**Section sources**
- [program.ts](file://src/cli/program.ts)
- [config-file.ts](file://src/cli/config-file.ts)
- [resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
- [output.ts](file://src/cli/output.ts)

### begin
Starts a new workflow run or step within a specified space with enhanced timeout protection.

- Syntax
  - kairos begin [options]
- Required parameters
  - None (contextual; depends on protocol definition)
- Optional parameters
  - --space: Target space path
  - --input or --payload: Provide initial inputs for the first step
  - --format: Output format
  - --timeout: Request timeout (enhanced with better defaults)
- Environment variables
  - KAIROS_API_BASE, KAIROS_SPACE, KAIROS_OUTPUT_FORMAT, KAIROS_HTTP_TIMEOUT
- Usage examples
  - Start a new run in the current space: kairos begin
  - Start a run with initial input: kairos begin --input '{"key":"value"}'
  - Start a run in a specific space: kairos begin --space "team/project"
- Command chaining patterns
  - Pipe output to jq for filtering: kairos begin | jq '.runId'
  - Capture run ID for subsequent steps: RUN_ID=$(kairos begin --json | jq -r '.runId')
- Output formatting options
  - text (default): Human-readable summary
  - json: Structured JSON suitable for automation
- Error handling
  - Invalid inputs return validation errors
  - Unauthorized requests prompt for login or fail with auth error
  - Network timeouts surface as retryable errors with enhanced timeout protection

**Updated** Enhanced timeout protection prevents long-running operations from hanging indefinitely.

**Section sources**
- [begin.ts](file://src/cli/commands/begin.ts)
- [output.ts](file://src/cli/output.ts)
- [resolve-api-base.ts](file://src/cli/resolve-api-base.ts)

### attest
Submits proof-of-work or attestation data for a given run or step with improved reliability.

- Syntax
  - kairos attest [options]
- Required parameters
  - Depends on protocol; often requires a run identifier and proof payload
- Optional parameters
  - --run-id: Target run
  - --step: Target step index or slug
  - --proof or --payload: Attestation data
  - --space: Target space path
  - --format: Output format
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_API_BASE, KAIROS_SPACE, KAIROS_OUTPUT_FORMAT, KAIROS_HTTP_TIMEOUT
- Usage examples
  - Attest a completed step: kairos attest --run-id "abc123" --step "analyze" --proof '{"score":0.9}'
  - Submit at run level: kairos attest --run-id "abc123" --proof '{"summary":"done"}'
- Command chaining patterns
  - Combine with search to target runs: kairos search --query "status:in_progress" | jq -r '.[0].id' | xargs -I{} kairos attest --run-id {}
- Output formatting options
  - text: Confirmation message
  - json: Attestation result object
- Error handling
  - Missing proof fields produce validation errors
  - Expired sessions require re-authentication
  - Server rejects invalid proofs with descriptive messages
  - Enhanced timeout protection prevents hanging during attestation

**Updated** Improved reliability for attestation operations with enhanced timeout handling.

**Section sources**
- [attest.ts](file://src/cli/commands/attest.ts)
- [output.ts](file://src/cli/output.ts)

### delete
Deletes artifacts, runs, or resources from a space with enhanced timeout protection.

- Syntax
  - kairos delete [options]
- Required parameters
  - Resource identifiers (e.g., run IDs, artifact paths)
- Optional parameters
  - --space: Target space path
  - --dry-run: Preview deletions without executing
  - --force: Skip confirmation prompts
  - --format: Output format
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_API_BASE, KAIROS_SPACE, KAIROS_OUTPUT_FORMAT, KAIROS_HTTP_TIMEOUT
- Usage examples
  - Delete a run: kairos delete --run-id "abc123"
  - Dry-run deletion: kairos delete --run-id "abc123" --dry-run
  - Force delete without confirmation: kairos delete --run-id "abc123" --force
- Command chaining patterns
  - Bulk delete using search results: kairos search --query "status:completed" | jq -r '.[].id' | xargs -I{} kairos delete --run-id {}
- Output formatting options
  - text: Deletion summary
  - json: List of deleted resource identifiers
- Error handling
  - Insufficient permissions return authorization errors
  - Non-existent resources report not found
  - Partial failures list affected items
  - Enhanced timeout protection prevents hanging during bulk operations

**Updated** Enhanced timeout protection for bulk deletion operations.

**Section sources**
- [delete.ts](file://src/cli/commands/delete.ts)
- [output.ts](file://src/cli/output.ts)

### export
Exports data, artifacts, or skill bundles from a space with improved reliability.

- Syntax
  - kairos export [options]
- Required parameters
  - Selection criteria (e.g., run IDs, adapters, filters)
- Optional parameters
  - --space: Target space path
  - --output or --out: Destination path or directory
  - --format: Output format (zip, jsonl, etc.)
  - --include-artifacts: Include binary artifacts
  - --compress: Enable compression
  - --filter or --query: Selection filter expression
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_API_BASE, KAIROS_SPACE, KAIROS_OUTPUT_FORMAT, KAIROS_HTTP_TIMEOUT
- Usage examples
  - Export a single run: kairos export --run-id "abc123" --output "./export.zip"
  - Export multiple runs filtered by query: kairos export --query "created_after:2024-01-01" --output "./bundle.zip"
  - Export with artifacts included: kairos export --run-id "abc123" --include-artifacts --output "./full-export.zip"
- Command chaining patterns
  - Generate selection from search: kairos search --query "tag:production" | jq -r '.[].id' | xargs -I{} kairos export --run-id {} --output "./exports/"
- Output formatting options
  - zip: Bundled export with metadata and artifacts
  - jsonl: Streamed records for large datasets
  - text: Summary of exported items
- Error handling
  - Large exports may time out; use pagination or chunked queries with enhanced timeout handling
  - Missing artifacts are skipped or reported based on flags
  - Permission errors prevent exporting protected resources
  - Improved reliability for large export operations

**Updated** Enhanced timeout protection and improved reliability for large export operations.

**Section sources**
- [export.ts](file://src/cli/commands/export.ts)
- [output.ts](file://src/cli/output.ts)

### login
Initiates OIDC interactive login to obtain access and refresh tokens with enhanced timeout protection and improved reliability.

- Syntax
  - kairos login [options]
- Required parameters
  - None (interactive flow)
- Optional parameters
  - --api-base: Override API base URL
  - --issuer or --client-id: Custom OIDC provider settings
  - --no-browser: Print URL only and wait for manual callback
  - --port: Local callback port (default dynamic)
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_API_BASE, KAIROS_OIDC_ISSUER, KAIROS_OIDC_CLIENT_ID
- Usage examples
  - Interactive login: kairos login
  - Print login URL only: kairos login --no-browser
  - Use custom issuer: kairos login --issuer "https://keycloak.example.com"
- OIDC flow details
  - CLI opens browser to authorization endpoint with timeout protection
  - User authenticates with provider
  - Provider redirects to local callback with authorization code
  - CLI exchanges code for tokens and persists them with enhanced reliability
  - **Updated** Enhanced timeout protection prevents authentication flows from hanging indefinitely
- Output formatting options
  - text: Success message and token info
  - json: Token metadata (without sensitive values)
- Error handling
  - Invalid issuer or client configuration returns early
  - Callback mismatches or expired codes indicate retry
  - Network issues suggest checking proxy/firewall settings
  - **Updated** Enhanced timeout protection prevents hanging during authentication flow

**Updated** Significantly improved reliability for authentication flows with comprehensive timeout protection to prevent hanging behavior.

**Section sources**
- [login.ts](file://src/cli/commands/login.ts)
- [http-auth-callback.ts](file://src/http/http-auth-callback.ts)
- [http-auth-oidc-redirect.ts](file://src/http/http-auth-oidc-redirect.ts)
- [rewrite-login-url.ts](file://src/cli/rewrite-login-url.ts)
- [safe-http-url.ts](file://src/cli/safe-http-url.ts)

### logout
Clears stored credentials and ends the active session with enhanced timeout protection.

- Syntax
  - kairos logout [options]
- Required parameters
  - None
- Optional parameters
  - --all: Clear all profiles if configured
  - --timeout: Request timeout (enhanced)
- Environment variables
  - None specific
- Usage examples
  - Clear current profile: kairos logout
  - Clear all profiles: kairos logout --all
- Output formatting options
  - text: Confirmation message
- Error handling
  - No active session returns informational message
  - Config write failures indicate permission issues
  - **Updated** Enhanced timeout protection prevents hanging during credential cleanup

**Updated** Enhanced timeout protection for logout operations to prevent hanging behavior.

**Section sources**
- [logout.ts](file://src/cli/commands/logout.ts)
- [config-file.ts](file://src/cli/config-file.ts)

### search
Searches memory or artifacts using query expressions with enhanced timeout protection.

- Syntax
  - kairos search [options]
- Required parameters
  - None (query provided via options)
- Optional parameters
  - --query or --q: Search expression
  - --space: Scope search to a space
  - --limit or --max: Max results
  - --offset: Pagination offset
  - --sort: Sorting field
  - --format: Output format
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_API_BASE, KAIROS_SPACE, KAIROS_OUTPUT_FORMAT, KAIROS_HTTP_TIMEOUT
- Usage examples
  - Basic search: kairos search --query "status:active"
  - Paginated results: kairos search --query "tag:prod" --limit 50 --offset 100
  - Sort by date: kairos search --query "type:artifact" --sort "created_at:desc"
- Command chaining patterns
  - Filter and pass IDs downstream: kairos search --query "status:failed" | jq -r '.[].id' | xargs -I{} kairos delete --run-id {}
- Output formatting options
  - text: Tabular summary
  - json: Array of result objects
  - table: Pretty-printed table
- Error handling
  - Malformed queries return validation errors
  - Rate limits suggest backoff and retries
  - Unauthorized scopes restrict visible results
  - **Updated** Enhanced timeout protection prevents hanging during complex searches

**Updated** Enhanced timeout protection for search operations to prevent hanging behavior.

**Section sources**
- [search.ts](file://src/cli/commands/search.ts)
- [output.ts](file://src/cli/output.ts)

### serve
Runs the Kairos server in local or development mode with enhanced timeout protection.

- Syntax
  - kairos serve [options]
- Required parameters
  - None
- Optional parameters
  - --host: Bind address (default 127.0.0.1)
  - --port: HTTP port (default dynamic)
  - --env or --profile: Environment profile
  - --db-url: Database connection string
  - --redis-url: Redis cache connection string
  - --qdrant-url: Vector store connection string
  - --log-level: Logging verbosity
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_DB_URL, KAIROS_REDIS_URL, KAIROS_QDRANT_URL, KAIROS_LOG_LEVEL
- Usage examples
  - Start server with defaults: kairos serve
  - Bind to specific host/port: kairos serve --host 0.0.0.0 --port 8080
  - Set database URL: kairos serve --db-url "postgres://user:pass@localhost/db"
- Output formatting options
  - text: Startup logs and health status
- Error handling
  - Port conflicts require changing --port
  - Missing dependencies (DB, Redis, Qdrant) cause startup failures
  - Health checks indicate readiness
  - **Updated** Enhanced timeout protection for server operations

**Updated** Enhanced timeout protection for server operations.

**Section sources**
- [serve.ts](file://src/cli/commands/serve.ts)

### spaces
Lists, creates, moves, or deletes workspaces and spaces with enhanced timeout protection.

- Syntax
  - kairos spaces [subcommand] [options]
- Subcommands
  - list: List available spaces
  - create: Create a new space
  - move: Move a space to a different parent
  - delete: Delete a space
- Common optional parameters
  - --parent or --path: Parent path or full space path
  - --name: Space name
  - --format: Output format
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_API_BASE, KAIROS_OUTPUT_FORMAT, KAIROS_HTTP_TIMEOUT
- Usage examples
  - List spaces: kairos spaces list
  - Create a space: kairos spaces create --name "analytics" --parent "team"
  - Move a space: kairos spaces move --path "team/analytics" --parent "dept"
  - Delete a space: kairos spaces delete --path "team/analytics"
- Command chaining patterns
  - Iterate over spaces: kairos spaces list --format json | jq -r '.[].path' | xargs -I{} kairos search --space {}
- Output formatting options
  - text: Hierarchical tree view
  - json: Structured list of spaces
- Error handling
  - Duplicate names return conflict errors
  - Insufficient permissions block creation/move/delete
  - Invalid paths return validation errors
  - **Updated** Enhanced timeout protection for space operations

**Updated** Enhanced timeout protection for space management operations.

**Section sources**
- [spaces.ts](file://src/cli/commands/spaces.ts)
- [output.ts](file://src/cli/output.ts)

### token
Displays or refreshes the current access token with enhanced timeout protection and improved reliability.

- Syntax
  - kairos token [options]
- Required parameters
  - None
- Optional parameters
  - --refresh: Force refresh using stored refresh token
  - --show-secret: Include raw token value (use cautiously)
  - --format: Output format
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_API_BASE, KAIROS_OUTPUT_FORMAT
- Usage examples
  - Show token info: kairos token
  - Refresh token: kairos token --refresh
  - Display raw token: kairos token --show-secret --format json
- Output formatting options
  - text: Expiration and scope summary
  - json: Token metadata and optional secret
- Error handling
  - Missing refresh token requires re-login
  - Refresh failures indicate network or provider issues
  - Secret display warns about security risks
  - **Updated** Enhanced timeout protection prevents hanging during token refresh operations

**Updated** Significantly improved reliability for token refresh operations with enhanced timeout protection to prevent hanging behavior.

**Section sources**
- [token.ts](file://src/cli/commands/token.ts)
- [oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [output.ts](file://src/cli/output.ts)

### update
Checks for and installs CLI updates with enhanced timeout protection.

- Syntax
  - kairos update [options]
- Required parameters
  - None
- Optional parameters
  - --channel: Update channel (stable, beta)
  - --force: Install without prompting
  - --dry-run: Check availability only
  - --timeout: Request timeout (enhanced)
- Environment variables
  - KAIROS_UPDATE_CHANNEL
- Usage examples
  - Check for updates: kairos update --dry-run
  - Install latest stable: kairos update --force
  - Switch to beta channel: kairos update --channel beta
- Output formatting options
  - text: Installation status and version info
- Error handling
  - Network errors prevent fetching manifests
  - Permission errors block installation
  - Incompatible versions warn before proceeding
  - **Updated** Enhanced timeout protection prevents hanging during update checks

**Updated** Enhanced timeout protection for update operations.

**Section sources**
- [update.ts](file://src/cli/commands/update.ts)

## Dependency Analysis
The CLI modules depend on shared configuration, authentication, and output utilities with enhanced timeout protection. Commands rely on the program router and HTTP client setup with comprehensive timeout handling.

```mermaid
graph LR
P["program.ts"] --> CFG["config-file.ts"]
P --> AUTHERR["auth-error.ts"]
P --> OUT["output.ts"]
P --> RESOLVE["resolve-api-base.ts"]
P --> REWRITE["rewrite-login-url.ts"]
P --> SAFEURL["safe-http-url.ts"]
P --> ORF["oauth-refresh.ts"]
P --> TIMEOUT["Timeout Protection"]
P --> CMD_BEGIN["begin.ts"]
P --> CMD_ATTEST["attest.ts"]
P --> CMD_DELETE["delete.ts"]
P --> CMD_EXPORT["export.ts"]
P --> CMD_LOGIN["login.ts"]
P --> CMD_LOGOUT["logout.ts"]
P --> CMD_SEARCH["search.ts"]
P --> CMD_SERVE["serve.ts"]
P --> CMD_SPACES["spaces.ts"]
P --> CMD_TOKEN["token.ts"]
P --> CMD_UPDATE["update.ts"]
```

**Updated** Enhanced timeout protection integrated throughout the dependency chain.

**Diagram sources**
- [program.ts](file://src/cli/program.ts)
- [config-file.ts](file://src/cli/config-file.ts)
- [auth-error.ts](file://src/cli/auth-error.ts)
- [output.ts](file://src/cli/output.ts)
- [resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
- [rewrite-login-url.ts](file://src/cli/rewrite-login-url.ts)
- [safe-http-url.ts](file://src/cli/safe-http-url.ts)
- [oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [begin.ts](file://src/cli/commands/begin.ts)
- [attest.ts](file://src/cli/commands/attest.ts)
- [delete.ts](file://src/cli/commands/delete.ts)
- [export.ts](file://src/cli/commands/export.ts)
- [login.ts](file://src/cli/commands/login.ts)
- [logout.ts](file://src/cli/commands/logout.ts)
- [search.ts](file://src/cli/commands/search.ts)
- [serve.ts](file://src/cli/commands/serve.ts)
- [spaces.ts](file://src/cli/commands/spaces.ts)
- [token.ts](file://src/cli/commands/token.ts)
- [update.ts](file://src/cli/commands/update.ts)

**Section sources**
- [program.ts](file://src/cli/program.ts)

## Performance Considerations
- Use pagination (--limit, --offset) for large search results to avoid memory pressure.
- Prefer JSON output for automation to reduce parsing overhead.
- Avoid excessive concurrent exports; batch operations to respect server rate limits.
- Configure appropriate timeouts for long-running operations with enhanced timeout protection.
- Reuse tokens via refresh to minimize authentication overhead.
- **Updated** Enhanced timeout protection prevents performance degradation from hanging operations.

**Updated** Enhanced timeout protection improves overall performance by preventing operations from hanging indefinitely.

## Troubleshooting Guide
Common issues and resolutions with enhanced timeout protection:
- Authentication failures
  - Ensure OIDC issuer and client ID are correct
  - Verify local callback port accessibility
  - Check network proxies and firewall rules
  - **Updated** Enhanced timeout protection helps identify authentication flow issues more quickly
- Authorization errors
  - Confirm user has required scopes for the requested operation
  - Re-login if tokens have expired or been revoked
- Export failures
  - Validate selection filters and resource existence
  - Increase timeout for large payloads with enhanced timeout handling
  - Check disk space and write permissions for output directories
- Server startup problems
  - Resolve port conflicts by changing --port
  - Ensure DB, Redis, and Qdrant services are reachable
  - Review logs for missing configuration keys
- **Updated** Hanging behavior
  - **New** Enhanced timeout protection should prevent most hanging scenarios
  - If operations still hang, check network connectivity and server responsiveness
  - Use --timeout flag to customize timeout behavior for problematic operations

**Updated** Enhanced troubleshooting guidance for timeout-related issues and hanging behavior prevention.

**Section sources**
- [auth-error.ts](file://src/cli/auth-error.ts)
- [oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [output.ts](file://src/cli/output.ts)

## Conclusion
The Kairos MCP CLI provides a robust set of commands for managing workflows, artifacts, and server operations with significantly enhanced timeout protection and improved reliability. By leveraging environment variables, output formatting, and command chaining, users can automate complex tasks efficiently. Proper authentication and error handling ensure reliable interactions with the server, while enhanced timeout protection prevents hanging behavior that previously affected authentication flows and other operations.

**Updated** Enhanced timeout protection and improved reliability make the CLI more robust and user-friendly, particularly for authentication flows that previously experienced hanging behavior.

## Appendices

### Command Chaining Patterns
- Extract IDs from search and feed into other commands:
  - kairos search --query "status:failed" | jq -r '.[].id' | xargs -I{} kairos delete --run-id {}
- Compose multi-step pipelines:
  - kairos begin --input '{}' | jq -r '.runId' | xargs -I{} kairos attest --run-id {} --proof '{}'
- Conditional execution:
  - kairos search --query "tag:critical" && kairos export --query "tag:critical" --output "./critical.zip"
- **Updated** Enhanced timeout protection ensures command chains execute reliably without hanging.

### Security Best Practices
- Avoid printing secrets; use --show-secret judiciously.
- Store tokens securely and rotate regularly.
- Restrict API base URLs to trusted domains.
- Use least-privilege scopes for OIDC clients.
- **Updated** Enhanced timeout protection reduces security risks from prolonged authentication sessions.

### Enhanced Timeout Configuration
- **New** Global timeout settings apply to all HTTP requests and authentication flows
- **New** Individual commands support custom timeout configuration via --timeout flag
- **New** Environment variable KAIROS_HTTP_TIMEOUT controls default timeout behavior
- **New** Enhanced error reporting for timeout scenarios helps diagnose network issues
- **New** Improved reliability for long-running operations like exports and searches

**Section sources**
- [program.ts](file://src/cli/program.ts)
- [config-file.ts](file://src/cli/config-file.ts)
- [oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [auth-error.ts](file://src/cli/auth-error.ts)
- [output.ts](file://src/cli/output.ts)