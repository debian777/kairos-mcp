# Getting Started

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [compose.yaml](file://compose.yaml)
- [docs/install/README.md](file://docs/install/README.md)
- [docs/install/prerequisites.md](file://docs/install/prerequisites.md)
- [docs/install/docker-compose-simple.md](file://docs/install/docker-compose-simple.md)
- [docs/install/docker-compose-full-stack.md](file://docs/install/docker-compose-full-stack.md)
- [docs/install/helm.md](file://docs/install/helm.md)
- [docs/CLI.md](file://docs/CLI.md)
- [scripts/deploy-run-env.sh](file://scripts/deploy-run-env.sh)
- [scripts/deploy-dev-cli-ready.sh](file://scripts/deploy-dev-cli-ready.sh)
- [helm/values.dev.yaml](file://helm/values.dev.yaml)
- [helm/values.prod.yaml](file://helm/values.prod.yaml)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites and System Requirements](#prerequisites-and-system-requirements)
3. [Installation Methods](#installation-methods)
4. [Quick Start Guides](#quick-start-guides)
5. [Environment Configuration](#environment-configuration)
6. [Health Check Verification](#health-check-verification)
7. [Initial Server Access](#initial-server-access)
8. [Deployment Scenarios](#deployment-scenarios)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)

## Introduction
KAIROS MCP is a TypeScript service that provides persistent memory and deterministic execution for AI agent workflows. It exposes:
- an MCP endpoint at POST /mcp
- REST endpoints under /api/*
- a browser UI under /ui
- a CLI named kairos

The system centers around three core ideas: persistent memory, deterministic execution (activate → forward → reward), and agent-facing design. This guide helps you install, configure, and verify KAIROS across development, production, and fullstack profiles.

## Prerequisites and System Requirements
Before installing KAIROS, confirm the following prerequisites:
- Node.js 24 or later (primary interface for authentication, bulk management, and verification)
- Docker Engine + Docker Compose v2 (for Docker Compose paths)
- Kubernetes 1.28+ with Helm 3.14+ and kubectl (for Helm chart path)
- Python 3 (for repository helper scripts or advanced operator workflows)
- A supported embedding backend (OpenAI, Ollama, or TEI)

Choose an embedding backend before creating your environment file. The application requires a text-embedding service to convert text into vectors for Qdrant.

**Section sources**
- [docs/install/prerequisites.md:11-44](file://docs/install/prerequisites.md#L11-L44)
- [docs/install/prerequisites.md:48-87](file://docs/install/prerequisites.md#L48-L87)

## Installation Methods
There are two primary installation paths:
- Docker Compose (recommended for local development or single-host deployments)
- Helm chart (recommended for Kubernetes clusters)

### Docker Compose
- Simple stack: Application + Qdrant (default profile)
- Full stack: Adds supporting services (Valkey/Redis, Postgres, Keycloak) via the fullstack profile

Start with the simple stack for first-time setup, then use the full stack when you need broader services.

**Section sources**
- [docs/install/README.md:18-36](file://docs/install/README.md#L18-L36)
- [docs/install/docker-compose-simple.md:13-42](file://docs/install/docker-compose-simple.md#L13-L42)
- [docs/install/docker-compose-full-stack.md:13-23](file://docs/install/docker-compose-full-stack.md#L13-L23)

### Helm Chart
- Install operators (Qdrant, Valkey, Percona PostgreSQL, Keycloak) using the provided manifests
- Configure values files for development or production
- Deploy using Helm upgrade --install

**Section sources**
- [docs/install/helm.md:9-33](file://docs/install/helm.md#L9-L33)
- [docs/install/helm.md:36-76](file://docs/install/helm.md#L36-L76)

## Quick Start Guides
Two quick start flows are provided to get you running quickly:

### Guided Setup with kairos-install Skill
Use this when you want a guided first-time setup for Ollama, .env configuration, and the minimal local stack:
1. Install the setup skill
2. Ask your agent to run kairos-install for this repo
3. Verify the server with curl /health
4. Open the UI or MCP endpoint

**Section sources**
- [README.md:110-137](file://README.md#L110-L137)

### Manual Minimal Docker Stack
Use this when you want the smallest working server deployment without the guided skill:
1. Create .env at the repository root with required variables
2. Start the stack with docker compose -p kairos-mcp up -d
3. Verify the server with curl /health
4. Open the UI or MCP endpoint

**Section sources**
- [README.md:138-167](file://README.md#L138-L167)
- [docs/install/docker-compose-simple.md:60-110](file://docs/install/docker-compose-simple.md#L60-L110)

## Environment Configuration
Environment variables drive KAIROS behavior. The minimal stack requires:
- QDRANT_API_KEY
- One embedding backend (OpenAI, Ollama, or TEI)

Ports:
- App: PORT (default 3000)
- Qdrant: 6333, 6344
- Metrics: METRICS_PORT (default 9090)

For the full stack, additional variables align with the chosen profile and secret management approach.

**Section sources**
- [docs/install/docker-compose-simple.md:65-92](file://docs/install/docker-compose-simple.md#L65-L92)
- [docs/install/docker-compose-full-stack.md:36-44](file://docs/install/docker-compose-full-stack.md#L36-L44)
- [compose.yaml:139-163](file://compose.yaml#L139-L163)

## Health Check Verification
After starting the stack, verify the server health:
- Use curl to hit the /health endpoint on the configured port
- For Docker Compose, the default port is 3000 unless overridden in .env
- For development scripts, the default port is often 3300

If the server does not start or returns 503, wait for Qdrant to finish starting, then retry.

**Section sources**
- [README.md:363-371](file://README.md#L363-L371)
- [docs/install/docker-compose-simple.md:95-110](file://docs/install/docker-compose-simple.md#L95-L110)
- [scripts/deploy-run-env.sh:553-561](file://scripts/deploy-run-env.sh#L553-L561)

## Initial Server Access
Once the server is healthy:
- UI: http://localhost:3000/ui
- MCP: http://localhost:3000/mcp
- Metrics: http://localhost:9090/metrics

Match the host and port used for health checks. The CLI is the primary interface for authentication, verification, and day-to-day operations.

**Section sources**
- [README.md:133-136](file://README.md#L133-L136)
- [docs/install/docker-compose-simple.md:105-110](file://docs/install/docker-compose-simple.md#L105-L110)
- [docs/CLI.md:45-61](file://docs/CLI.md#L45-L61)

## Deployment Scenarios
Choose the scenario that matches your environment:

### Development Profile (Docker Compose Simple)
- Recommended for local development and first-time setup
- Starts only the application and Qdrant
- Use AUTH_ENABLED=false for quick start

**Section sources**
- [docs/install/docker-compose-simple.md:13-42](file://docs/install/docker-compose-simple.md#L13-L42)
- [docs/install/docker-compose-simple.md:60-110](file://docs/install/docker-compose-simple.md#L60-L110)

### Production Profile (Helm)
- Use the Helm chart for Kubernetes deployments
- Configure values files for your environment
- Enable authentication and TLS as needed

**Section sources**
- [docs/install/helm.md:36-76](file://docs/install/helm.md#L36-L76)
- [helm/values.prod.yaml:10-47](file://helm/values.prod.yaml#L10-L47)

### Fullstack Profile (Docker Compose)
- Adds supporting services: Valkey, Postgres, Keycloak
- Use when you need a broader local environment or want to model a production-like topology
- Start with docker compose -p kairos-mcp --profile fullstack up -d

**Section sources**
- [docs/install/docker-compose-full-stack.md:48-58](file://docs/install/docker-compose-full-stack.md#L48-L58)
- [compose.yaml:10-8](file://compose.yaml#L10-L8)

## Troubleshooting Guide
Common startup issues and resolutions:
- The server does not start: Check container logs and verify required ports are free
- Health check returns 503: Wait for Qdrant to finish starting, then retry
- Embeddings fail on startup: Set one working embedding backend in .env
- Auth-enabled development is failing: Use the fullstack env example, start the fullstack profile, and configure realms
- The CLI keeps asking for login: Confirm the API URL and token validity; validate with kairos token --validate

Additional verification steps:
- Use the CLI to check connectivity and authentication
- Confirm embedding backend health and configuration
- For Helm deployments, verify pods and routes with kubectl

**Section sources**
- [README.md:346-401](file://README.md#L346-L401)
- [docs/install/docker-compose-simple.md:150-158](file://docs/install/docker-compose-simple.md#L150-L158)
- [scripts/deploy-run-env.sh:553-561](file://scripts/deploy-run-env.sh#L553-L561)
- [docs/CLI.md:335-374](file://docs/CLI.md#L335-L374)

## Conclusion
You now have the essentials to install, configure, and verify KAIROS across development, production, and fullstack profiles. Start with the simple Docker Compose path for local development, then move to the Helm chart for Kubernetes production. Use the CLI for authentication and verification, and refer to the troubleshooting section for common issues.