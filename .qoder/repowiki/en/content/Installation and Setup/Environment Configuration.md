# Environment Configuration

<cite>
**Referenced Files in This Document**
- [src/config.ts](file://src/config.ts)
- [src/cli/config.ts](file://src/cli/config.ts)
- [src/http/http-server-config.ts](file://src/http/http-server-config.ts)
- [src/bootstrap.ts](file://src/bootstrap.ts)
- [src/server.ts](file://src/server.ts)
- [compose.yaml](file://compose.yaml)
- [Dockerfile](file://Dockerfile)
- [helm/kairos-mcp/values.yaml](file://helm/kairos-mcp/values.yaml)
- [scripts/env/create-env.sh](file://scripts/env/create-env.sh)
- [.devcontainer/devcontainer.json.base](file://.devcontainer/devcontainer.json.base)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Configuration File Formats](#configuration-file-formats)
8. [Security Configuration](#security-configuration)
9. [Feature Flags and Performance Tuning](#feature-flags-and-performance-tuning)
10. [Logging Configuration](#logging-configuration)
11. [Configuration Templates](#configuration-templates)
12. [Configuration Validation and Error Handling](#configuration-validation-and-error-handling)
13. [Containerized Deployment](#containerized-deployment)
14. [Troubleshooting Guide](#troubleshooting-guide)
15. [Migration Strategies](#migration-strategies)
16. [Conclusion](#conclusion)

## Introduction

Kairos MCP is a Model Context Protocol server that provides AI-powered development workflows and memory management capabilities. The application supports comprehensive environment configuration through multiple mechanisms including environment variables, configuration files, and container orchestration platforms. This document provides detailed guidance on configuring Kairos MCP for various deployment scenarios while maintaining security best practices and operational excellence.

The configuration system supports dynamic reloading, feature flags, performance tuning parameters, and secure authentication mechanisms including OIDC providers. It's designed to work seamlessly across development, staging, and production environments with appropriate security postures.

## Project Structure

The Kairos MCP configuration system is distributed across multiple components:

```mermaid
graph TB
subgraph "Configuration Sources"
ENV[Environment Variables]
FILE[Config Files]
SECRETS[Secrets Management]
DEFAULTS[Default Values]
end
subgraph "Configuration Processing"
LOADER[Config Loader]
VALIDATOR[Config Validator]
RESOLVER[Config Resolver]
end
subgraph "Runtime Configuration"
SERVER[HTTP Server Config]
CLI[CLI Config]
SERVICES[Service Config]
AUTH[Auth Config]
end
ENV --> LOADER
FILE --> LOADER
SECRETS --> LOADER
DEFAULTS --> LOADER
LOADER --> VALIDATOR
VALIDATOR --> RESOLVER
RESOLVER --> SERVER
RESOLVER --> CLI
RESOLVER --> SERVICES
RESOLVER --> AUTH
```

**Diagram sources**
- [src/config.ts:1-50](file://src/config.ts#L1-L50)
- [src/bootstrap.ts:1-30](file://src/bootstrap.ts#L1-L30)

**Section sources**
- [src/config.ts:1-100](file://src/config.ts#L1-L100)
- [src/bootstrap.ts:1-50](file://src/bootstrap.ts#L1-L50)

## Core Components

The configuration system consists of several key components that work together to provide a robust and flexible configuration management solution:

### Configuration Loader
Responsible for loading configuration from multiple sources with proper precedence handling.

### Configuration Validator
Ensures all required configuration values are present and valid before application startup.

### Dynamic Configuration Resolver
Handles runtime configuration updates and hot-reloading capabilities.

### Security Configuration Manager
Manages sensitive configuration including secrets, certificates, and authentication settings.

**Section sources**
- [src/config.ts:50-150](file://src/config.ts#L50-L150)
- [src/cli/config.ts:1-100](file://src/cli/config.ts#L1-L100)

## Architecture Overview

The Kairos MCP configuration architecture follows a layered approach with clear separation of concerns:

```mermaid
sequenceDiagram
participant App as Application
participant Loader as Config Loader
participant Validator as Config Validator
participant Resolver as Config Resolver
participant Services as Runtime Services
App->>Loader : Initialize Configuration
Loader->>Loader : Load Environment Variables
Loader->>Loader : Load Config Files
Loader->>Loader : Load Secrets
Loader->>Validator : Validate Configuration
Validator-->>Loader : Validation Result
Loader->>Resolver : Resolve Final Configuration
Resolver-->>App : Complete Configuration
App->>Services : Configure Services
Services-->>App : Ready
```

**Diagram sources**
- [src/bootstrap.ts:20-80](file://src/bootstrap.ts#L20-L80)
- [src/config.ts:100-200](file://src/config.ts#L100-L200)

## Detailed Component Analysis

### HTTP Server Configuration
The HTTP server configuration manages network interfaces, TLS settings, CORS policies, and API endpoints.

### CLI Configuration
The CLI configuration handles command-line argument parsing, local development settings, and user preferences.

### Service Configuration
Service-specific configurations for database connections, caching layers, and external service integrations.

### Authentication Configuration
OIDC provider settings, session management, and security policies.

**Section sources**
- [src/http/http-server-config.ts:1-100](file://src/http/http-server-config.ts#L1-L100)
- [src/cli/config.ts:50-150](file://src/cli/config.ts#L50-L150)

## Environment Variables Reference

### Core Application Settings

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `APP_PORT` | number | No | 3000 | HTTP server port |
| `APP_HOST` | string | No | localhost | Server bind address |
| `APP_ENV` | enum | No | development | Application environment (development, staging, production) |
| `APP_NAME` | string | Yes | kairos-mcp | Application display name |
| `APP_VERSION` | string | No | auto-detected | Application version override |

### Database Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DB_CONNECTION_STRING` | string | Yes | - | PostgreSQL connection URL |
| `DB_POOL_SIZE` | number | No | 10 | Database connection pool size |
| `DB_SSL_MODE` | enum | No | prefer | SSL mode (disable, allow, prefer, require, verify-ca, verify-full) |
| `DB_SSL_CERT` | string | Conditional | - | Client certificate path (when SSL required) |
| `DB_SSL_KEY` | string | Conditional | - | Client key path (when SSL required) |

### Redis Cache Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REDIS_URL` | string | No | redis://localhost:6379 | Redis connection URL |
| `REDIS_PASSWORD` | string | Conditional | - | Redis password (if authentication enabled) |
| `REDIS_CLUSTER_ENABLED` | boolean | No | false | Enable Redis cluster mode |
| `REDIS_MAX_RETRIES` | number | No | 3 | Maximum retry attempts for Redis operations |

### OIDC Authentication Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `OIDC_ISSUER` | string | Conditional | - | OIDC provider issuer URL |
| `OIDC_CLIENT_ID` | string | Conditional | - | OIDC client identifier |
| `OIDC_CLIENT_SECRET` | string | Conditional | - | OIDC client secret |
| `OIDC_SCOPES` | string | No | openid profile email | Space-separated OIDC scopes |
| `OIDC_ADMIN_GROUPS` | string | No | - | Comma-separated admin group names |
| `OIDC_USER_GROUPS` | string | No | - | Comma-separated user group names |

### Qdrant Vector Database Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `QDRANT_URL` | string | No | http://localhost:6333 | Qdrant service URL |
| `QDRANT_API_KEY` | string | Conditional | - | Qdrant API key (if authentication enabled) |
| `QDRANT_COLLECTION_PREFIX` | string | No | kairos_ | Collection name prefix |
| `QDRANT_VECTOR_DIMENSIONS` | number | No | 1536 | Embedding vector dimensions |

### Logging Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `LOG_LEVEL` | enum | No | info | Log level (debug, info, warn, error) |
| `LOG_FORMAT` | enum | No | json | Log format (json, text) |
| `LOG_OUTPUT` | enum | No | stdout | Log output destination (stdout, file) |
| `LOG_FILE_PATH` | string | Conditional | /var/log/kairos-mcp.log | Log file path (when LOG_OUTPUT=file) |

### Feature Flags

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `FEATURE_NEW_MEMORY_SYSTEM` | boolean | No | true | Enable new memory system features |
| `FEATURE_EXPERIMENTAL_TOOLS` | boolean | No | false | Enable experimental tool features |
| `FEATURE_METRICS_EXPORT` | boolean | No | true | Enable Prometheus metrics export |
| `FEATURE_DEBUG_ENDPOINTS` | boolean | No | false | Enable debug endpoints (never enable in production) |

### Performance Tuning

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WORKER_THREADS` | number | No | auto | Number of worker threads |
| `MAX_CONCURRENT_REQUESTS` | number | No | 100 | Maximum concurrent HTTP requests |
| `REQUEST_TIMEOUT_MS` | number | No | 30000 | Request timeout in milliseconds |
| `CACHE_TTL_SECONDS` | number | No | 3600 | Default cache time-to-live |
| `EMBEDDING_BATCH_SIZE` | number | No | 10 | Batch size for embedding operations |

**Section sources**
- [src/config.ts:150-300](file://src/config.ts#L150-L300)
- [src/http/http-server-config.ts:50-150](file://src/http/http-server-config.ts#L50-L150)

## Configuration File Formats

### YAML Configuration Files

Kairos MCP supports YAML configuration files for structured configuration management:

```yaml
# kairos.config.yaml
app:
  name: "kairos-mcp"
  environment: "production"
  port: 3000
  
database:
  connection_string: "${DB_CONNECTION_STRING}"
  pool_size: 20
  ssl_mode: "require"

redis:
  url: "${REDIS_URL}"
  max_retries: 5

oidc:
  issuer: "${OIDC_ISSUER}"
  client_id: "${OIDC_CLIENT_ID}"
  client_secret: "${OIDC_CLIENT_SECRET}"
  scopes: "openid profile email"
  
logging:
  level: "info"
  format: "json"
  output: "stdout"
```

### JSON Configuration Files

Alternative JSON format support for environments preferring JSON:

```json
{
  "app": {
    "name": "kairos-mcp",
    "environment": "production",
    "port": 3000
  },
  "database": {
    "connection_string": "${DB_CONNECTION_STRING}",
    "pool_size": 20
  }
}
```

### Configuration Precedence Rules

Configuration values are resolved in the following order (highest precedence first):

1. Command-line arguments
2. Environment variables
3. Configuration files (YAML/JSON)
4. Default values

**Section sources**
- [src/config.ts:200-350](file://src/config.ts#L200-L350)
- [src/cli/config.ts:100-200](file://src/cli/config.ts#L100-L200)

## Security Configuration

### OIDC Provider Setup

Configure OIDC authentication for enterprise identity management:

#### Keycloak Integration

```bash
# Keycloak Configuration
export OIDC_ISSUER="https://keycloak.example.com/realms/kairos"
export OIDC_CLIENT_ID="kairos-mcp-client"
export OIDC_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET}"
export OIDC_SCOPES="openid profile email groups"
export OIDC_ADMIN_GROUPS="kairos-admins,kairos-developers"
export OIDC_USER_GROUPS="kairos-users"
```

#### Google OAuth Integration

```bash
# Google OAuth Configuration
export OIDC_ISSUER="https://accounts.google.com"
export OIDC_CLIENT_ID="${GOOGLE_CLIENT_ID}"
export OIDC_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}"
export OIDC_SCOPES="openid email profile"
```

### Database Security

#### PostgreSQL SSL Configuration

```bash
# SSL-enabled Database Connection
export DB_CONNECTION_STRING="postgresql://user:password@host:5432/dbname?sslmode=require&sslcert=/path/to/client.crt&sslkey=/path/to/client.key&sslrootcert=/path/to/ca.crt"
export DB_SSL_MODE="verify-full"
```

#### Connection Pool Security

```bash
# Secure Connection Pool Settings
export DB_POOL_SIZE=20
export DB_SSL_MODE="require"
```

### API Security

#### JWT Token Configuration

```bash
# JWT Token Settings
export JWT_SECRET="${JWT_SECRET}"
export JWT_EXPIRY="24h"
export JWT_REFRESH_EXPIRY="7d"
```

#### Rate Limiting

```bash
# API Rate Limiting
export RATE_LIMIT_WINDOW_MS=900000
export RATE_LIMIT_MAX_REQUESTS=1000
export RATE_LIMIT_BAN_DURATION_MS=3600000
```

**Section sources**
- [src/http/http-auth-middleware.ts:1-100](file://src/http/http-auth-middleware.ts#L1-L100)
- [src/services/oidc-state-store.ts:1-100](file://src/services/oidc-state-store.ts#L1-L100)

## Feature Flags and Performance Tuning

### Feature Flag Management

Feature flags enable gradual rollout of new functionality and A/B testing:

```bash
# Enable New Memory System
export FEATURE_NEW_MEMORY_SYSTEM=true

# Enable Experimental Tools
export FEATURE_EXPERIMENTAL_TOOLS=false

# Enable Metrics Export
export FEATURE_METRICS_EXPORT=true

# Enable Debug Endpoints (Development Only)
export FEATURE_DEBUG_ENDPOINTS=false
```

### Performance Optimization

#### Worker Process Configuration

```bash
# Multi-threaded Processing
export WORKER_THREADS=4
export MAX_CONCURRENT_REQUESTS=200
export REQUEST_TIMEOUT_MS=60000
```

#### Caching Strategy

```bash
# Cache Configuration
export CACHE_TTL_SECONDS=3600
export CACHE_MAX_SIZE_MB=512
export CACHE_BACKEND="redis"
```

#### Embedding Performance

```bash
# Embedding Optimization
export EMBEDDING_BATCH_SIZE=20
export EMBEDDING_MODEL="text-embedding-3-large"
export EMBEDDING_TIMEOUT_MS=30000
```

**Section sources**
- [src/config.ts:300-450](file://src/config.ts#L300-L450)
- [src/services/embedding/config.ts:1-100](file://src/services/embedding/config.ts#L1-L100)

## Logging Configuration

### Log Levels and Formats

```bash
# Production Logging
export LOG_LEVEL="warn"
export LOG_FORMAT="json"
export LOG_OUTPUT="stdout"

# Development Logging
export LOG_LEVEL="debug"
export LOG_FORMAT="text"
export LOG_OUTPUT="stdout"
```

### Structured Logging

Kairos MCP uses structured logging for better observability:

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "info",
  "message": "Server started",
  "service": "kairos-mcp",
  "version": "1.0.0",
  "environment": "production",
  "pid": 1234,
  "request_id": "abc-123-def"
}
```

### Log Rotation and Retention

```bash
# Log File Configuration
export LOG_OUTPUT="file"
export LOG_FILE_PATH="/var/log/kairos-mcp/app.log"
export LOG_MAX_SIZE_MB=100
export LOG_MAX_FILES=10
```

**Section sources**
- [src/utils/structured-logger.ts:1-100](file://src/utils/structured-logger.ts#L1-L100)
- [src/utils/log-core.ts:1-100](file://src/utils/log-core.ts#L1-L100)

## Configuration Templates

### Development Environment

```bash
# .env.development
APP_ENV=development
APP_PORT=3000
APP_HOST=localhost

DB_CONNECTION_STRING="postgresql://postgres:postgres@localhost:5432/kairos_dev"
DB_SSL_MODE=disable
DB_POOL_SIZE=5

REDIS_URL=redis://localhost:6379

OIDC_ISSUER=http://localhost:8080/realms/kairos-dev
OIDC_CLIENT_ID=kairos-mcp-dev
OIDC_CLIENT_SECRET=dev-secret

LOG_LEVEL=debug
LOG_FORMAT=text
FEATURE_DEBUG_ENDPOINTS=true
```

### Staging Environment

```bash
# .env.staging
APP_ENV=staging
APP_PORT=3000
APP_HOST=0.0.0.0

DB_CONNECTION_STRING="postgresql://${STAGING_DB_USER}:${STAGING_DB_PASS}@${STAGING_DB_HOST}:5432/kairos_staging"
DB_SSL_MODE=require
DB_POOL_SIZE=10

REDIS_URL=redis://${STAGING_REDIS_HOST}:6379
REDIS_PASSWORD=${STAGING_REDIS_PASSWORD}

OIDC_ISSUER=https://keycloak-staging.example.com/realms/kairos
OIDC_CLIENT_ID=kairos-mcp-staging
OIDC_CLIENT_SECRET=${STAGING_OIDC_CLIENT_SECRET}

LOG_LEVEL=info
LOG_FORMAT=json
```

### Production Environment

```bash
# .env.production
APP_ENV=production
APP_PORT=3000
APP_HOST=0.0.0.0

DB_CONNECTION_STRING="postgresql://${PROD_DB_USER}:${PROD_DB_PASS}@${PROD_DB_HOST}:5432/kairos_prod?sslmode=verify-full"
DB_SSL_MODE=verify-full
DB_POOL_SIZE=20

REDIS_URL=redis://${PROD_REDIS_HOST}:6379
REDIS_PASSWORD=${PROD_REDIS_PASSWORD}

OIDC_ISSUER=https://keycloak-prod.example.com/realms/kairos
OIDC_CLIENT_ID=kairos-mcp-prod
OIDC_CLIENT_SECRET=${PROD_OIDC_CLIENT_SECRET}
OIDC_ADMIN_GROUPS="kairos-admins"
OIDC_USER_GROUPS="kairos-users"

LOG_LEVEL=warn
LOG_FORMAT=json
FEATURE_DEBUG_ENDPOINTS=false
```

**Section sources**
- [scripts/env/create-env.sh:1-100](file://scripts/env/create-env.sh#L1-L100)
- [.devcontainer/devcontainer.json.base:1-50](file://.devcontainer/devcontainer.json.base#L1-L50)

## Configuration Validation and Error Handling

### Validation Rules

The configuration system implements comprehensive validation:

```mermaid
flowchart TD
Start([Configuration Load]) --> Parse["Parse Configuration"]
Parse --> ValidateRequired["Validate Required Fields"]
ValidateRequired --> RequiredValid{"All Required Fields Present?"}
RequiredValid --> |No| ErrorMissing["Error: Missing Required Configuration"]
RequiredValid --> |Yes| ValidateTypes["Validate Data Types"]
ValidateTypes --> TypesValid{"Types Valid?"}
TypesValid --> |No| ErrorTypes["Error: Invalid Configuration Types"]
TypesValid --> |Yes| ValidateValues["Validate Value Ranges"]
ValidateValues --> ValuesValid{"Values Valid?"}
ValuesValid --> |No| ErrorRanges["Error: Invalid Configuration Values"]
ValuesValid --> |Yes| ValidateDependencies["Validate Dependencies"]
ValidateDependencies --> DepsValid{"Dependencies Satisfied?"}
DepsValid --> |No| ErrorDeps["Error: Missing Dependencies"]
DepsValid --> |Yes| Success["Configuration Valid"]
ErrorMissing --> Exit([Exit with Error])
ErrorTypes --> Exit
ErrorRanges --> Exit
ErrorDeps --> Exit
Success --> Exit
```

**Diagram sources**
- [src/config.ts:350-500](file://src/config.ts#L350-L500)

### Error Handling

Configuration errors are handled gracefully with informative messages:

- **Missing Required Configuration**: Clear indication of which variables are missing
- **Invalid Data Types**: Specific type requirements and examples
- **Value Range Violations**: Allowed ranges and default fallbacks
- **Dependency Errors**: Guidance on resolving configuration dependencies

**Section sources**
- [src/config.ts:450-600](file://src/config.ts#L450-L600)

## Containerized Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production
ENV APP_PORT=3000
ENV LOG_LEVEL=warn

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose Configuration

```yaml
# compose.yaml
version: '3.8'

services:
  kairos-mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - APP_ENV=production
      - DB_CONNECTION_STRING=postgresql://postgres:postgres@db:5432/kairos
      - REDIS_URL=redis://redis:6379
      - OIDC_ISSUER=https://keycloak:8080/realms/kairos
    depends_on:
      - db
      - redis
      - keycloak

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kairos
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
    command: start-dev
```

### Kubernetes Deployment

```yaml
# helm/kairos-mcp/values.yaml
replicaCount: 2

image:
  repository: kairos/mcp
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3000

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

env:
  APP_ENV: production
  LOG_LEVEL: warn
  FEATURE_DEBUG_ENDPOINTS: "false"

secrets:
  DB_CONNECTION_STRING:
    valueFrom:
      secretKeyRef:
        name: kairos-secrets
        key: db-connection-string
  OIDC_CLIENT_SECRET:
    valueFrom:
      secretKeyRef:
        name: kairos-secrets
        key: oidc-client-secret
```

**Section sources**
- [compose.yaml:1-100](file://compose.yaml#L1-L100)
- [Dockerfile:1-50](file://Dockerfile#L1-L50)
- [helm/kairos-mcp/values.yaml:1-100](file://helm/kairos-mcp/values.yaml#L1-L100)

## Troubleshooting Guide

### Common Configuration Issues

#### Database Connection Problems

**Symptoms**: Connection timeouts, authentication failures
**Solutions**:
- Verify connection string format
- Check database credentials
- Ensure network connectivity
- Validate SSL certificate paths

#### OIDC Authentication Failures

**Symptoms**: Login redirects, token validation errors
**Solutions**:
- Verify OIDC issuer URL
- Check client ID and secret
- Validate redirect URIs
- Review scope permissions

#### Redis Connection Issues

**Symptoms**: Cache misses, session loss
**Solutions**:
- Verify Redis URL and authentication
- Check Redis availability
- Validate cluster configuration
- Review network policies

### Configuration Validation Commands

```bash
# Validate configuration
npm run config:validate

# Test database connection
npm run config:test-db

# Test OIDC configuration
npm run config:test-oidc

# Test Redis connection
npm run config:test-redis
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
export LOG_LEVEL=debug
export FEATURE_DEBUG_ENDPOINTS=true
```

**Section sources**
- [src/config.ts:500-650](file://src/config.ts#L500-L650)

## Migration Strategies

### Configuration Schema Evolution

When updating configuration schemas, follow these migration strategies:

#### Backward Compatibility

- Maintain support for deprecated configuration keys
- Provide migration scripts for automated updates
- Use graceful degradation for missing optional fields

#### Versioned Configuration

```yaml
# kairos.config.v2.yaml
version: "2.0"
app:
  name: "kairos-mcp"
  environment: "production"
```

#### Rollback Procedures

- Keep previous configuration versions available
- Implement configuration backup and restore
- Test configuration changes in staging before production

### Secret Rotation

```bash
# Rotate database credentials
./scripts/rotate-secrets.sh --type database --new-password $(openssl rand -base64 32)

# Rotate OIDC client secrets
./scripts/rotate-secrets.sh --type oidc --client-id kairos-mcp-prod

# Rotate encryption keys
./scripts/rotate-secrets.sh --type encryption --algorithm aes-256-gcm
```

**Section sources**
- [scripts/env/create-env.sh:50-150](file://scripts/env/create-env.sh#L50-L150)

## Conclusion

Kairos MCP provides a comprehensive and flexible configuration system that supports diverse deployment scenarios while maintaining security and operational excellence. The multi-layered configuration approach ensures reliability through validation, error handling, and rollback capabilities.

Key benefits include:

- **Flexibility**: Multiple configuration sources with clear precedence rules
- **Security**: Comprehensive security configuration for OIDC, databases, and APIs
- **Scalability**: Performance tuning parameters for various workload sizes
- **Observability**: Structured logging and monitoring integration
- **Reliability**: Robust validation and error handling
- **Portability**: Support for containerized and orchestrated deployments

By following the guidelines and templates provided in this document, you can deploy Kairos MCP securely and efficiently across development, staging, and production environments.