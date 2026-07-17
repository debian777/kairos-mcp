# Testing Strategy and Frameworks

<cite>
**Referenced Files in This Document**
- [jest.config.js](file://jest.config.js)
- [vitest.config.ts](file://vitest.config.ts)
- [package.json](file://package.json)
- [tests/setup.ts](file://tests/setup.ts)
- [tests/global-setup-auth.ts](file://tests/global-setup-auth.ts)
- [tests/global-teardown-auth.ts](file://tests/global-teardown-auth.ts)
- [tests/jest-sequencer.cjs](file://tests/jest-sequencer.cjs)
- [tests/ui/setup.ts](file://tests/ui/setup.ts)
- [tests/integration/harness/index.ts](file://tests/integration/harness/index.ts)
- [tests/utils/keycloak-container.ts](file://tests/utils/keycloak-container.ts)
- [tests/utils/keycloak-client-admin.ts](file://tests/utils/keycloak-client-admin.ts)
- [tests/utils/auth-headers.ts](file://tests/utils/auth-headers.ts)
- [tests/utils/mcp-client-utils.ts](file://tests/utils/mcp-client-utils.ts)
- [tests/unit/oauth-refresh.test.ts](file://tests/unit/oauth-refresh.test.ts)
- [tests/integration/auth-keycloak.test.ts](file://tests/integration/auth-keycloak.test.ts)
- [tests/integration/http-api-test-helpers.ts](file://tests/integration/http-api-test-helpers.ts)
- [tests/integration/v4-kairos-activate.test.ts](file://tests/integration/v4-kairos-activate.test.ts)
</cite>

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

## Introduction
This document explains the testing strategy and framework setup for Kairos MCP. It covers the dual testing approach using Jest for unit tests and Vitest for modern TypeScript and UI tests, including configuration, environment setup, global fixtures, authentication testing with Keycloak integration, test data management, database seeding, service mocking patterns, and guidelines for organizing and naming tests. It also provides examples of common testing patterns used across the codebase.

## Project Structure
The repository organizes tests under a dedicated tests directory with clear categorization:
- Unit tests: Pure logic and utility functions without external dependencies
- Integration tests: End-to-end flows against real or containerized services (Keycloak, Redis, Qdrant)
- UI tests: React components and hooks using Vitest + DOM testing utilities
- Load tests: Concurrency and performance scenarios
- Shared utilities and mocks: Reusable helpers for auth, MCP clients, fixtures, and infrastructure

```mermaid
graph TB
subgraph "Tests"
U["Unit Tests<br/>tests/unit"]
I["Integration Tests<br/>tests/integration"]
UI["UI Tests<br/>tests/ui"]
L["Load Tests<br/>tests/load"]
SH["Shared Utils & Mocks<br/>tests/utils, tests/mocks, tests/test-data"]
end
subgraph "Frameworks"
J["Jest Config<br/>jest.config.js"]
V["Vitest Config<br/>vitest.config.ts"]
P["Package Scripts<br/>package.json"]
end
U --> J
I --> J
UI --> V
L --> J
SH --> J
SH --> V
P --> J
P --> V
```

**Diagram sources**
- [jest.config.js](file://jest.config.js)
- [vitest.config.ts](file://vitest.config.ts)
- [package.json](file://package.json)

**Section sources**
- [jest.config.js](file://jest.config.js)
- [vitest.config.ts](file://vitest.config.ts)
- [package.json](file://package.json)

## Core Components
- Dual frameworks:
  - Jest for unit and integration tests
  - Vitest for TypeScript-first and UI tests
- Global lifecycle:
  - Global setup/teardown for shared state and external services
  - Per-suite setup files for environment initialization
- Authentication:
  - Keycloak container orchestration and admin client utilities
  - Auth header helpers for authenticated requests
- Test harness:
  - Integration harness to bootstrap server and services
  - MCP client utilities for tool invocation and assertions
- Data and fixtures:
  - Centralized test data and artifact fixtures
  - Seeding scripts and snapshot utilities

**Section sources**
- [tests/setup.ts](file://tests/setup.ts)
- [tests/global-setup-auth.ts](file://tests/global-setup-auth.ts)
- [tests/global-teardown-auth.ts](file://tests/global-teardown-auth.ts)
- [tests/ui/setup.ts](file://tests/ui/setup.ts)
- [tests/integration/harness/index.ts](file://tests/integration/harness/index.ts)
- [tests/utils/keycloak-container.ts](file://tests/utils/keycloak-container.ts)
- [tests/utils/keycloak-client-admin.ts](file://tests/utils/keycloak-client-admin.ts)
- [tests/utils/auth-headers.ts](file://tests/utils/auth-headers.ts)
- [tests/utils/mcp-client-utils.ts](file://tests/utils/mcp-client-utils.ts)

## Architecture Overview
The testing architecture separates concerns by framework and scope:
- Jest runs unit and integration suites with global auth lifecycle and sequencer control
- Vitest runs UI tests with its own setup and DOM environment
- Shared utilities provide consistent auth, MCP client behavior, and fixture management

```mermaid
sequenceDiagram
participant Dev as "Developer"
participant NPM as "NPM Scripts"
participant Jest as "Jest Runner"
participant Vitest as "Vitest Runner"
participant GS as "Global Setup (Auth)"
participant Suite as "Test Suite"
participant KC as "Keycloak Container"
participant Srv as "App Server Harness"
Dev->>NPM : Run tests
alt Jest path
NPM->>Jest : jest --config jest.config.js
Jest->>GS : Execute global setup
GS->>KC : Start Keycloak
GS-->>Jest : Ready
Jest->>Suite : Run unit/integration tests
Suite->>Srv : Use harness to start server
Suite->>KC : Authenticate via OIDC
Suite-->>Jest : Results
Jest->>GS : Teardown (global teardown)
else Vitest path
NPM->>Vitest : vitest --config vitest.config.ts
Vitest->>Suite : Run UI tests
Suite-->>Vitest : Results
end
```

**Diagram sources**
- [jest.config.js](file://jest.config.js)
- [vitest.config.ts](file://vitest.config.ts)
- [tests/global-setup-auth.ts](file://tests/global-setup-auth.ts)
- [tests/global-teardown-auth.ts](file://tests/global-teardown-auth.ts)
- [tests/integration/harness/index.ts](file://tests/integration/harness/index.ts)
- [tests/utils/keycloak-container.ts](file://tests/utils/keycloak-container.ts)

## Detailed Component Analysis

### Jest Configuration and Environment
- Purpose: Configure Jest for unit and integration tests, including module resolution, coverage, and custom reporters
- Key aspects:
  - Module name mapping and resolver settings
  - Test environment selection and setup files
  - Custom sequencer for deterministic ordering when needed
  - Coverage thresholds and reporting

**Section sources**
- [jest.config.js](file://jest.config.js)
- [tests/jest-sequencer.cjs](file://tests/jest-sequencer.cjs)

### Vitest Configuration and UI Environment
- Purpose: Configure Vitest for TypeScript-first testing and UI component tests
- Key aspects:
  - Environment setup for DOM testing
  - Alias resolution and preprocessor options
  - Test file pattern matching for UI suite
  - Integration with existing TS config

**Section sources**
- [vitest.config.ts](file://vitest.config.ts)
- [tests/ui/setup.ts](file://tests/ui/setup.ts)

### Global Lifecycle and Shared Fixtures
- Global setup:
  - Starts Keycloak container and prepares realms/users
  - Exposes shared environment variables and endpoints
- Global teardown:
  - Stops containers and cleans up resources
- Per-suite setup:
  - Initializes app-level fixtures and resets state between suites

**Section sources**
- [tests/global-setup-auth.ts](file://tests/global-setup-auth.ts)
- [tests/global-teardown-auth.ts](file://tests/global-teardown-auth.ts)
- [tests/setup.ts](file://tests/setup.ts)

### Authentication Testing Infrastructure (Keycloak)
- Container orchestration:
  - Spin up Keycloak with realm import and user provisioning
- Admin client:
  - Programmatic operations on realms, clients, and users
- Auth headers:
  - Helpers to obtain tokens and build request headers
- Example usage:
  - Unit tests for OAuth refresh flow
  - Integration tests validating OIDC login and protected routes

```mermaid
flowchart TD
Start(["Start Auth Flow"]) --> InitKC["Initialize Keycloak Container"]
InitKC --> ImportRealm["Import Realm and Users"]
ImportRealm --> GetToken["Obtain Access Token"]
GetToken --> BuildHeaders["Build Auth Headers"]
BuildHeaders --> CallAPI["Call Protected API"]
CallAPI --> VerifyResponse["Verify Response and State"]
VerifyResponse --> Cleanup["Cleanup Resources"]
Cleanup --> End(["Done"])
```

**Diagram sources**
- [tests/utils/keycloak-container.ts](file://tests/utils/keycloak-container.ts)
- [tests/utils/keycloak-client-admin.ts](file://tests/utils/keycloak-client-admin.ts)
- [tests/utils/auth-headers.ts](file://tests/utils/auth-headers.ts)
- [tests/unit/oauth-refresh.test.ts](file://tests/unit/oauth-refresh.test.ts)
- [tests/integration/auth-keycloak.test.ts](file://tests/integration/auth-keycloak.test.ts)

**Section sources**
- [tests/utils/keycloak-container.ts](file://tests/utils/keycloak-container.ts)
- [tests/utils/keycloak-client-admin.ts](file://tests/utils/keycloak-client-admin.ts)
- [tests/utils/auth-headers.ts](file://tests/utils/auth-headers.ts)
- [tests/unit/oauth-refresh.test.ts](file://tests/unit/oauth-refresh.test.ts)
- [tests/integration/auth-keycloak.test.ts](file://tests/integration/auth-keycloak.test.ts)

### Integration Test Harness and MCP Client Utilities
- Harness:
  - Bootstraps the application server and required services for integration tests
  - Provides stable base URLs and lifecycle hooks
- MCP client utilities:
  - Helpers to invoke tools, parse responses, and assert contracts
- Example usage:
  - HTTP API endpoint validation
  - v4 activation and forward flows

```mermaid
sequenceDiagram
participant Test as "Integration Test"
participant Harness as "Server Harness"
participant App as "Kairos Server"
participant MCP as "MCP Client Utils"
Test->>Harness : Start server and services
Harness-->>Test : Base URL ready
Test->>MCP : Initialize client
Test->>App : Send request/tool call
App-->>MCP : JSON-RPC or HTTP response
MCP-->>Test : Parsed result
Test->>Test : Assert behavior and schema
Test->>Harness : Stop server and cleanup
```

**Diagram sources**
- [tests/integration/harness/index.ts](file://tests/integration/harness/index.ts)
- [tests/utils/mcp-client-utils.ts](file://tests/utils/mcp-client-utils.ts)
- [tests/integration/http-api-test-helpers.ts](file://tests/integration/http-api-test-helpers.ts)
- [tests/integration/v4-kairos-activate.test.ts](file://tests/integration/v4-kairos-activate.test.ts)

**Section sources**
- [tests/integration/harness/index.ts](file://tests/integration/harness/index.ts)
- [tests/utils/mcp-client-utils.ts](file://tests/utils/mcp-client-utils.ts)
- [tests/integration/http-api-test-helpers.ts](file://tests/integration/http-api-test-helpers.ts)
- [tests/integration/v4-kairos-activate.test.ts](file://tests/integration/v4-kairos-activate.test.ts)

### Test Data Management, Database Seeding, and Service Mocking
- Test data:
  - Centralized fixtures under tests/test-data for artifacts and sample content
- Seeding:
  - Scripts and utilities to seed databases and caches before running suites
- Service mocking:
  - Replace external dependencies with lightweight stubs or in-memory implementations
  - Use per-test isolation to avoid cross-test pollution

Guidelines:
- Keep fixtures small and focused on the scenario being tested
- Seed only what is necessary for each suite
- Prefer deterministic mocks over network calls for speed and reliability

**Section sources**
- [tests/test-data/AI_CODING_RULES.md](file://tests/test-data/AI_CODING_RULES.md)
- [tests/test-data/cli-minimal-test.md](file://tests/test-data/cli-minimal-test.md)
- [tests/test-data/kairos-search-score-baseline.json](file://tests/test-data/kairos-search-score-baseline.json)

### Guidelines for Organizing Tests, Naming, and Categorization
- Organization:
  - Group by concern: unit, integration, ui, load
  - Co-locate related helpers under tests/utils and tests/mocks
- Naming conventions:
  - Use descriptive names that reflect the feature and scenario
  - Append .test.ts or .e2e.test.ts where applicable
- Categorization:
  - Unit: Fast, isolated, no external services
  - Integration: Requires server and external services (Keycloak, Redis, Qdrant)
  - UI: Component and hook tests with DOM environment
  - E2E: Full workflow across boundaries

Best practices:
- Keep tests independent and idempotent
- Use shared setup only for expensive initialization; reset state per suite
- Avoid flakiness by controlling time and randomness deterministically

[No sources needed since this section provides general guidance]

### Common Testing Patterns
- Unit tests:
  - Validate pure functions and internal logic with minimal setup
  - Example: OAuth refresh flow edge cases
- Integration tests:
  - Exercise HTTP APIs and MCP tool contracts end-to-end
  - Example: Activation and forward workflows
- UI tests:
  - Render components and assert interactions and rendered output
- Contract tests:
  - Ensure schema consistency and backward compatibility

Examples:
- OAuth refresh unit test
- Keycloak integration test
- HTTP API helper usage
- v4 activation integration test

**Section sources**
- [tests/unit/oauth-refresh.test.ts](file://tests/unit/oauth-refresh.test.ts)
- [tests/integration/auth-keycloak.test.ts](file://tests/integration/auth-keycloak.test.ts)
- [tests/integration/http-api-test-helpers.ts](file://tests/integration/http-api-test-helpers.ts)
- [tests/integration/v4-kairos-activate.test.ts](file://tests/integration/v4-kairos-activate.test.ts)

## Dependency Analysis
The testing stack depends on configuration files and shared utilities:
- Jest and Vitest configurations drive runner behavior
- Package scripts orchestrate execution
- Shared utilities centralize auth, MCP client, and harness logic

```mermaid
graph LR
Pkg["package.json"] --> JestCfg["jest.config.js"]
Pkg --> VitestCfg["vitest.config.ts"]
JestCfg --> GS["tests/global-setup-auth.ts"]
JestCfg --> Seq["tests/jest-sequencer.cjs"]
VitestCfg --> UISetup["tests/ui/setup.ts"]
GS --> KC["tests/utils/keycloak-container.ts"]
GS --> KCA["tests/utils/keycloak-client-admin.ts"]
GS --> AH["tests/utils/auth-headers.ts"]
Seq --> Harness["tests/integration/harness/index.ts"]
Harness --> MCP["tests/utils/mcp-client-utils.ts"]
```

**Diagram sources**
- [package.json](file://package.json)
- [jest.config.js](file://jest.config.js)
- [vitest.config.ts](file://vitest.config.ts)
- [tests/global-setup-auth.ts](file://tests/global-setup-auth.ts)
- [tests/jest-sequencer.cjs](file://tests/jest-sequencer.cjs)
- [tests/ui/setup.ts](file://tests/ui/setup.ts)
- [tests/utils/keycloak-container.ts](file://tests/utils/keycloak-container.ts)
- [tests/utils/keycloak-client-admin.ts](file://tests/utils/keycloak-client-admin.ts)
- [tests/utils/auth-headers.ts](file://tests/utils/auth-headers.ts)
- [tests/integration/harness/index.ts](file://tests/integration/harness/index.ts)
- [tests/utils/mcp-client-utils.ts](file://tests/utils/mcp-client-utils.ts)

**Section sources**
- [package.json](file://package.json)
- [jest.config.js](file://jest.config.js)
- [vitest.config.ts](file://vitest.config.ts)
- [tests/global-setup-auth.ts](file://tests/global-setup-auth.ts)
- [tests/jest-sequencer.cjs](file://tests/jest-sequencer.cjs)
- [tests/ui/setup.ts](file://tests/ui/setup.ts)
- [tests/utils/keycloak-container.ts](file://tests/utils/keycloak-container.ts)
- [tests/utils/keycloak-client-admin.ts](file://tests/utils/keycloak-client-admin.ts)
- [tests/utils/auth-headers.ts](file://tests/utils/auth-headers.ts)
- [tests/integration/harness/index.ts](file://tests/integration/harness/index.ts)
- [tests/utils/mcp-client-utils.ts](file://tests/utils/mcp-client-utils.ts)

## Performance Considerations
- Prefer unit tests for fast feedback; reserve integration and UI tests for critical paths
- Use deterministic mocks to avoid network latency and flakiness
- Parallelize independent suites; limit concurrency for resource-heavy tests
- Cache snapshots and fixtures locally; invalidate selectively
- Profile slow tests and refactor into smaller, focused suites

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Keycloak not reachable:
  - Ensure global setup started the container successfully
  - Verify realm import completed and credentials are correct
- Flaky integration tests:
  - Add explicit waits for service readiness
  - Isolate state changes per suite and reset after each run
- UI test failures due to environment:
  - Confirm Vitest DOM setup is loaded and polyfills are present
- Slow test runs:
  - Reduce scope of seeded data
  - Use targeted test filters to run specific suites

**Section sources**
- [tests/global-setup-auth.ts](file://tests/global-setup-auth.ts)
- [tests/global-teardown-auth.ts](file://tests/global-teardown-auth.ts)
- [tests/ui/setup.ts](file://tests/ui/setup.ts)

## Conclusion
Kairos MCP employs a robust dual-framework testing strategy: Jest for unit and integration tests and Vitest for modern TypeScript and UI tests. The architecture emphasizes clear separation of concerns, reusable authentication and MCP utilities, and disciplined organization. By following the provided guidelines and leveraging shared fixtures and harnesses, teams can maintain fast, reliable, and comprehensive test coverage across all layers of the system.