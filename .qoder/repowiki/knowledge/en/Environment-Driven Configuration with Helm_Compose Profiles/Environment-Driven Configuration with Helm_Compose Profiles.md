---
kind: configuration_system
name: Environment-Driven Configuration with Helm/Compose Profiles
category: configuration_system
scope:
    - '**'
source_files:
    - src/config.ts
    - src/cli/config.ts
    - src/cli/config-file.ts
    - scripts/env/.env.template
    - scripts/deploy-run-env.sh
    - compose.yaml
    - helm/kairos-mcp/values.yaml
    - helm/kairos-mcp/templates/kairos-mcp-deployment.yaml
---

KAIROS uses a purely environment-variable-driven configuration system layered over profile-based deployment manifests. There is no runtime config file parser for the server — all settings come from process.env, resolved at import time in src/config.ts. The CLI has its own small persistent store for API URL and tokens, but it still falls back to env vars first.

### What system/approach is used
- Single source of truth: src/config.ts reads every application setting via typed helpers (getEnvString, getEnvInt, getEnvBoolean, getEnvRequired) that parse and validate process.env. Missing required keys throw at startup.
- No framework: No dotenv library, no YAML/TOML loader at runtime. Environment variables are consumed directly.
- Profile overlays: Local dev uses scripts/deploy-run-env.sh which sources .env plus an optional .env.<ENV> overlay (dev / dev_simple / dev_stdio / prod) and injects defaults per profile before launching the process.
- Container orchestration profiles: Docker Compose (compose.yaml) and Helm (helm/kairos-mcp/values.yaml) map chart/compose values into the same env var names the app expects, so the same binary runs unchanged across local, compose, and Kubernetes.

### Key files and packages
- src/config.ts — central env-var registry; exports typed constants and validation (required-key checks, derived values like AUTH_TRUSTED_ISSUERS, GROUP_SPACE_PATH_EXAMPLE).
- src/cli/config.ts + src/cli/config-file.ts — CLI-only: resolves API base URL from KAIROS_API_URL -> XDG config file defaultUrl -> http://localhost:3000; persists bearer/refresh tokens in OS keyring or a JSON file under $XDG_CONFIG_HOME/kairos.
- scripts/env/.env.template — canonical list of all supported env vars with comments describing each one.
- scripts/deploy-run-env.sh — loads .env + .env.<ENV>, applies profile-specific defaults (ports, Qdrant URL), starts/stops the server, runs health checks.
- compose.yaml — maps compose services' env into the same variable names (QDRANT_URL, KEYCLOAK_URL, SERVER_PORT, TRANSPORT_TYPE, ...).
- helm/kairos-mcp/values.yaml + helm/kairos-mcp/templates/kairos-mcp-deployment.yaml — chart values rendered as env: entries on the Deployment pod spec.
- helm/kairos-mcp/values.schema.json — JSON Schema validating chart values.
- Dockerfile* / Dockerfile.dev / Dockerfile.stdio — container entrypoints pass through env without modification.

### Architecture and conventions
1. Env-first, fail-closed: Every option is an env var with a documented default. Required vars (e.g. QDRANT_URL, and when AUTH_ENABLED=true: KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, AUTH_CALLBACK_BASE_URL, SESSION_SECRET) cause a thrown error at startup.
2. Legacy alias support: Some vars accept two names (e.g. KEY_VALUE_STORE_URL vs REDIS_URL, KAIROS_REDIS_PREFIX vs KAIROS_KEY_VALUE_PREFIX); the resolver picks the newer name if set, otherwise falls back to the legacy one.
3. Derived configuration: Several exported values are computed from other env vars (e.g. AUTH_TRUSTED_ISSUERS derives from KEYCLOAK_URL+KEYCLOAK_REALM; OIDC_SCOPES_SUPPORTED parses a comma-separated string; GROUP_SPACE_PATH_EXAMPLE is inferred from OIDC_GROUPS_ALLOWLIST).
4. Transport selection: TRANSPORT_TYPE=stdio|http switches between stdio MCP and HTTP server; kairos serve sets KAIROS_CLI_SERVE=1 so the default becomes stdio only in that context.
5. Secrets via platform secrets: In Helm, secrets (session secret, OpenAI key) are injected via valueFrom.secretKeyRef; in Compose they come from .env. The template validates ha.antiAffinity.mode and topology keys at render time.
6. CLI persistence separate from server: The CLI's XDG config file stores only non-secret metadata (defaultUrl, environments map) and token placeholders; actual tokens live in the OS keyring when available.

### Rules developers should follow
- Add new options by exporting a typed constant from src/config.ts using the helper getters; document the env var in scripts/env/.env.template.
- If a feature needs a file-backed config, keep it out of the server path — use the existing CLI config subsystem (src/cli/config-file.ts) instead of adding another parser.
- When supporting a new backend (Redis, embedding provider, etc.), add both a primary and a legacy alias in the resolver to avoid breaking existing deployments.
- For Kubernetes deployments, expose the corresponding values.yaml key and wire it into templates/kairos-mcp-deployment.yaml as an env var; prefer secretKeyRef for sensitive data.
- Do not read process.env outside src/config.ts for shared settings — always import the exported constant so defaults/validation apply uniformly.
- Profile overrides must go through deploy-run-env.sh (or Helm/Compose), never by editing the running process's env manually.