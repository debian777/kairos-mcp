# Getting Started

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [compose.yaml](file://compose.yaml)
- [Dockerfile](file://Dockerfile)
- [package.json](file://package.json)
- [src/index.ts](file://src/index.ts)
- [src/server.ts](file://src/server.ts)
- [src/bootstrap.ts](file://src/bootstrap.ts)
- [src/config.ts](file://src/config.ts)
- [src/http/http-server-startup.ts](file://src/http/http-server-startup.ts)
- [src/cli/program.ts](file://src/cli/program.ts)
- [src/cli/commands/serve.ts](file://src/cli/commands/serve.ts)
- [src/cli/commands/login.ts](file://src/cli/commands/login.ts)
- [src/cli/commands/token.ts](file://src/cli/commands/token.ts)
- [src/cli/commands/search.ts](file://src/cli/commands/search.ts)
- [src/cli/commands/spaces.ts](file://src/cli/commands/spaces.ts)
- [src/cli/commands/export.ts](file://src/cli/commands/export.ts)
- [src/cli/commands/train.ts](file://src/cli/commands/train.ts)
- [src/cli/commands/update.ts](file://src/cli/commands/update.ts)
- [src/cli/config-file.ts](file://src/cli/config-file.ts)
- [src/cli/config.ts](file://src/cli/config.ts)
- [src/cli/api-client.ts](file://src/cli/api-client.ts)
- [src/cli/resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
- [src/cli/safe-http-url.ts](file://src/cli/safe-http-url.ts)
- [src/cli/oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [src/cli/auth-error.ts](file://src/cli/auth-error.ts)
- [src/cli/keyring.ts](file://src/cli/keyring.ts)
- [src/services/redis.ts](file://src/services/redis.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)
- [src/services/embedding/service.ts](file://src/services/embedding/service.ts)
- [src/utils/global-error-handlers.ts](file://src/utils/global-error-handlers.ts)
- [scripts/env/create-env.sh](file://scripts/env/create-env.sh)
- [scripts/ci-wait-for-infra.sh](file://scripts/ci-wait-for-infra.sh)
- [docs/install/prerequisites.md](file://docs/install/prerequisites.md)
- [docs/install/docker-compose-simple.md](file://docs/install/docker-compose-simple.md)
- [docs/install/docker-compose-full-stack.md](file://docs/install/docker-compose-full-stack.md)
- [docs/CLI.md](file://docs/CLI.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Quick Start with Docker Compose](#quick-start-with-docker-compose)
4. [Local Development with npm](#local-development-with-npm)
5. [Basic Configuration](#basic-configuration)
6. [Start the Server and Access the Web Interface](#start-the-server-and-access-the-web-interface)
7. [Run Your First CLI Command](#run-your-first-cli-command)
8. [Troubleshooting Common Issues](#troubleshooting-common-issues)
9. [Next Steps](#next-steps)

## Introduction
This guide helps you install, configure, and run Kairos MCP quickly using Docker Compose or npm. You will start the server, open the web interface, and execute your first CLI commands to interact with the system.

## Prerequisites
Before installing, ensure the following are available on your machine:
- Node.js (LTS recommended)
- npm
- Docker and Docker Compose
- External services:
  - PostgreSQL
  - Redis
  - Qdrant

For detailed prerequisites and environment requirements, see:
- [docs/install/prerequisites.md](file://docs/install/prerequisites.md)

**Section sources**
- [docs/install/prerequisites.md](file://docs/install/prerequisites.md)

## Quick Start with Docker Compose
The repository includes a compose file that orchestrates the application and its dependencies.

Steps:
1. Clone the repository and navigate to the project root.
2. Ensure Docker is running and your user has permission to use Docker.
3. Use the provided compose file to start all services:
   - Run: docker compose up --build
4. Wait for the services to initialize. The application will be accessible at the configured HTTP port.

Notes:
- The compose file defines the main service and required infrastructure. See:
  - [compose.yaml](file://compose.yaml)
- The container image is built from:
  - [Dockerfile](file://Dockerfile)

After startup:
- Open the web UI at http://localhost:<port> (use the port defined in your configuration).
- Verify health endpoints if exposed by your configuration.

**Section sources**
- [compose.yaml](file://compose.yaml)
- [Dockerfile](file://Dockerfile)

## Local Development with npm
If you prefer to run the server locally without containers:

1. Install dependencies:
   - npm ci
2. Build the UI assets (if required by your setup):
   - npm run build
3. Configure environment variables as described in Basic Configuration.
4. Start the server:
   - npm start

The server entry points and bootstrap logic are implemented in:
- [src/index.ts](file://src/index.ts)
- [src/server.ts](file://src/server.ts)
- [src/bootstrap.ts](file://src/bootstrap.ts)

**Section sources**
- [package.json](file://package.json)
- [src/index.ts](file://src/index.ts)
- [src/server.ts](file://src/server.ts)
- [src/bootstrap.ts](file://src/bootstrap.ts)

## Basic Configuration
Kairos MCP reads configuration from environment variables. Key areas include:
- Application server settings (host, port)
- Database connection (PostgreSQL)
- Cache/session store (Redis)
- Vector search index (Qdrant)
- Embedding provider settings
- Authentication (OIDC) and UI base URL

Configuration loading and defaults are handled in:
- [src/config.ts](file://src/config.ts)

Service integrations:
- Redis client initialization: [src/services/redis.ts](file://src/services/redis.ts)
- Qdrant service initialization: [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)
- Embedding service initialization: [src/services/embedding/service.ts](file://src/services/embedding/service.ts)

Environment scaffolding helper:
- [scripts/env/create-env.sh](file://scripts/env/create-env.sh)

Tips:
- For simple setups, follow the minimal compose example:
  - [docs/install/docker-compose-simple.md](file://docs/install/docker-compose-simple.md)
- For full stack including Keycloak and additional components:
  - [docs/install/docker-compose-full-stack.md](file://docs/install/docker-compose-full-stack.md)

**Section sources**
- [src/config.ts](file://src/config.ts)
- [src/services/redis.ts](file://src/services/redis.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)
- [src/services/embedding/service.ts](file://src/services/embedding/service.ts)
- [scripts/env/create-env.sh](file://scripts/env/create-env.sh)
- [docs/install/docker-compose-simple.md](file://docs/install/docker-compose-simple.md)
- [docs/install/docker-compose-full-stack.md](file://docs/install/docker-compose-full-stack.md)

## Start the Server and Access the Web Interface
Starting the server:
- Using Docker Compose: docker compose up --build
- Using npm: npm start

HTTP server startup and routing are implemented in:
- [src/http/http-server-startup.ts](file://src/http/http-server-startup.ts)

Once started:
- Open the web UI at http://localhost:<port> (replace <port> with your configured port).
- If authentication is enabled, log in via the configured OIDC provider.

**Section sources**
- [src/http/http-server-startup.ts](file://src/http/http-server-startup.ts)

## Run Your First CLI Command
The CLI provides commands to manage sessions, spaces, exports, training, and more.

Common first steps:
- Login to authenticate:
  - kairos login
- Get or refresh an access token:
  - kairos token
- Search across your data:
  - kairos search "<query>"
- List or manage spaces:
  - kairos spaces list
- Export artifacts:
  - kairos export ...
- Train models or datasets:
  - kairos train ...
- Update the CLI:
  - kairos update

CLI program and command implementations:
- Program entry and command registration: [src/cli/program.ts](file://src/cli/program.ts)
- Serve command (for local development): [src/cli/commands/serve.ts](file://src/cli/commands/serve.ts)
- Authentication and tokens:
  - [src/cli/commands/login.ts](file://src/cli/commands/login.ts)
  - [src/cli/commands/token.ts](file://src/cli/commands/token.ts)
- Core operations:
  - [src/cli/commands/search.ts](file://src/cli/commands/search.ts)
  - [src/cli/commands/spaces.ts](file://src/cli/commands/spaces.ts)
  - [src/cli/commands/export.ts](file://src/cli/commands/export.ts)
  - [src/cli/commands/train.ts](file://src/cli/commands/train.ts)
  - [src/cli/commands/update.ts](file://src/cli/commands/update.ts)

CLI configuration and API client:
- Config file handling: [src/cli/config-file.ts](file://src/cli/config-file.ts)
- Runtime config resolution: [src/cli/config.ts](file://src/cli/config.ts)
- API client and base URL resolution:
  - [src/cli/api-client.ts](file://src/cli/api-client.ts)
  - [src/cli/resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
  - [src/cli/safe-http-url.ts](file://src/cli/safe-http-url.ts)
- OAuth refresh and auth error handling:
  - [src/cli/oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
  - [src/cli/auth-error.ts](file://src/cli/auth-error.ts)
- Secure storage helpers:
  - [src/cli/keyring.ts](file://src/cli/keyring.ts)

For a complete reference of CLI commands and options, see:
- [docs/CLI.md](file://docs/CLI.md)

**Section sources**
- [src/cli/program.ts](file://src/cli/program.ts)
- [src/cli/commands/serve.ts](file://src/cli/commands/serve.ts)
- [src/cli/commands/login.ts](file://src/cli/commands/login.ts)
- [src/cli/commands/token.ts](file://src/cli/commands/token.ts)
- [src/cli/commands/search.ts](file://src/cli/commands/search.ts)
- [src/cli/commands/spaces.ts](file://src/cli/commands/spaces.ts)
- [src/cli/commands/export.ts](file://src/cli/commands/export.ts)
- [src/cli/commands/train.ts](file://src/cli/commands/train.ts)
- [src/cli/commands/update.ts](file://src/cli/commands/update.ts)
- [src/cli/config-file.ts](file://src/cli/config-file.ts)
- [src/cli/config.ts](file://src/cli/config.ts)
- [src/cli/api-client.ts](file://src/cli/api-client.ts)
- [src/cli/resolve-api-base.ts](file://src/cli/resolve-api-base.ts)
- [src/cli/safe-http-url.ts](file://src/cli/safe-http-url.ts)
- [src/cli/oauth-refresh.ts](file://src/cli/oauth-refresh.ts)
- [src/cli/auth-error.ts](file://src/cli/auth-error.ts)
- [src/cli/keyring.ts](file://src/cli/keyring.ts)
- [docs/CLI.md](file://docs/CLI.md)

## Troubleshooting Common Issues
- Cannot connect to PostgreSQL:
  - Verify host, port, credentials, and database name in environment variables.
  - Ensure the database is reachable from the application container or localhost.
- Redis connection errors:
  - Confirm Redis URL and network accessibility.
  - Check firewall rules and container networking.
- Qdrant not responding:
  - Validate Qdrant endpoint and collection readiness.
  - Review initialization logs for migration or schema issues.
- Embedding provider failures:
  - Check provider credentials and rate limits.
  - Inspect embedding service logs for errors.
- Authentication problems:
  - Ensure OIDC issuer, client ID, and redirect URLs are correct.
  - Use the CLI login flow to obtain a valid token.
- Health checks failing:
  - Use the health endpoints exposed by the HTTP server to verify readiness.

Helpful scripts and utilities:
- Environment scaffolding: [scripts/env/create-env.sh](file://scripts/env/create-env.sh)
- Infrastructure wait helper (used in CI and tests): [scripts/ci-wait-for-infra.sh](file://scripts/ci-wait-for-infra.sh)
- Global error handlers for consistent logging: [src/utils/global-error-handlers.ts](file://src/utils/global-error-handlers.ts)

**Section sources**
- [scripts/env/create-env.sh](file://scripts/env/create-env.sh)
- [scripts/ci-wait-for-infra.sh](file://scripts/ci-wait-for-infra.sh)
- [src/utils/global-error-handlers.ts](file://src/utils/global-error-handlers.ts)

## Next Steps
- Explore advanced installation options:
  - Simple stack: [docs/install/docker-compose-simple.md](file://docs/install/docker-compose-simple.md)
  - Full stack with Keycloak: [docs/install/docker-compose-full-stack.md](file://docs/install/docker-compose-full-stack.md)
- Learn about architecture and components:
  - [docs/architecture/README.md](file://docs/architecture/README.md)
- Dive into CLI usage:
  - [docs/CLI.md](file://docs/CLI.md)

[No sources needed since this section summarizes without analyzing specific files]