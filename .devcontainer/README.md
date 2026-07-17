# KAIROS MCP Dev Containers

This directory contains [Dev Container](https://containers.dev/) configurations for developing KAIROS MCP. Dev Containers provide a consistent, reproducible development environment with all dependencies pre-configured.

## Available Configurations

### 1. KAIROS MCP Development (Simple)

**File**: `devcontainer.json.base` (symlinked to `devcontainer.json` by default)

Includes:
- Node.js 24 runtime (from `Dockerfile.dev`)
- Qdrant vector database
- Source code mounting with live reload
- Python 3.11 for helper scripts
- Docker-in-Docker support

**Use for**: Daily coding, feature development, unit testing.

**Resource requirements**: 4 CPUs, 8GB RAM, 32GB storage.

### 2. KAIROS MCP Fullstack

**File**: `devcontainer-fullstack.json`

Includes everything in Simple, plus:
- Valkey (Redis-compatible state/cache)
- PostgreSQL (Keycloak database)
- Keycloak (OIDC authentication)
- Automatic Keycloak realm initialization

**Use for**: Integration testing, E2E workflows, authentication testing.

**Resource requirements**: 6 CPUs, 12GB RAM, 40GB storage.

## Quick Start

### VS Code / Cursor

1. Open the project folder
2. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Linux/Windows)
3. Run **"Dev Containers: Reopen in Container"**
4. The default configuration (simple) will be used automatically

### Switching Configurations

The project uses symlinks to switch between configurations:

```bash
# View current configuration
.devcontainer/use-config.sh

# Switch to fullstack (with Valkey, Postgres, Keycloak)
.devcontainer/use-config.sh fullstack

# Switch back to simple (Node.js + Qdrant only)
.devcontainer/use-config.sh simple
```

**How it works**: `devcontainer.json` is a symlink that points to either `devcontainer.json.base` (simple) or `devcontainer-fullstack.json`. The helper script manages this symlink for you.

**Manual switching** (if you prefer):
```bash
# Switch to fullstack
rm .devcontainer/devcontainer.json
ln -s devcontainer-fullstack.json .devcontainer/devcontainer.json

# Switch to simple
rm .devcontainer/devcontainer.json
ln -s devcontainer.json.base .devcontainer/devcontainer.json
```

### GitHub Codespaces

When creating a codespace, you'll be prompted to choose a configuration. Select the appropriate one based on your needs.

### Fullstack-Specific Setup

After container starts with fullstack configuration, initialize services:
```bash
npm run infra:up
```

## Post-Setup Steps

After the container starts:

1. **Create `.env` file** (if not present):
   ```bash
   cp .env.dev_simple .env
   # Edit .env with your embedding backend configuration
   ```

2. **Install dependencies and build**:
   ```bash
   npm run dev:deploy
   ```

3. **Verify setup**:
   ```bash
   npm run dev:status
   npm run dev:test
   ```

## Troubleshooting

### Container fails to start

- **Check Docker Desktop**: Ensure it's running with sufficient resources allocated
- **Check port conflicts**: Ports 3300, 6333 (simple) or 3300, 6379, 5432, 8080 (fullstack) must be available
- **View logs**: `docker compose logs app-dev`

### `.env` file missing

The container will warn you during setup. Copy the template:
```bash
cp .env.dev_simple .env
```

See `docs/install/prerequisites.md` for embedding backend configuration.

### Node modules mismatch

If you see build errors related to `node_modules`:
```bash
docker compose down -v
# Restart container
```

This clears the anonymous volume and reinstalls dependencies.

### Python scripts fail

Python 3.11 is installed via Dev Container Features. If scripts fail:
```bash
python3 --version  # Should be 3.11.x
which python3      # Should be /usr/local/bin/python3
```

### "Unable to open '${localWorkspaceFolderBasename}'" error

This error means VS Code/Cursor is not resolving the `${localWorkspaceFolderBasename}` variable in `workspaceFolder`.

**Diagnosis:**
```bash
# Test variable resolution with devcontainer CLI
npm install -g @devcontainers/cli
devcontainer read-configuration --workspace-folder .
```

If the CLI shows `"workspaceFolder": "/workspaces/kairos-mcp-dev-containers"` (resolved), but VS Code shows the literal `${localWorkspaceFolderBasename}`, the issue is with your VS Code/Cursor Dev Containers extension.

**Fixes:**
1. **Update Dev Containers extension** to the latest version
2. **Restart VS Code/Cursor** completely (not just reload window)
3. **Check for conflicting extensions** that may interfere with variable resolution
4. **Use devcontainer CLI directly** as a workaround:
   ```bash
   devcontainer up --workspace-folder .
   ```

**Why this happens:**
- `${localWorkspaceFolderBasename}` is a VS Code-specific variable
- It's resolved by the Dev Containers extension when opening via VS Code UI
- The devcontainer CLI always resolves it correctly
- If the extension fails to resolve it, the literal string is used as the folder name

### Need more help?

- Full installation guide: `docs/install/README.md`
- Contributing guide: `CONTRIBUTING.md`
- Dev Container spec: https://containers.dev/

## Testing

### Local Testing

**Quick validation** (fast, for PR checks):
```bash
npm run devcontainer:validate
# or
.devcontainer/validate.sh --quick
```

This validates:
- JSON/YAML syntax
- Symlink configuration
- Required fields in devcontainer.json
- Referenced files exist (Dockerfile.dev, compose.yaml)
- Docker Compose merge compatibility
- **Variable resolution** (catches `${localWorkspaceFolderBasename}` issues via devcontainer CLI)

**Full validation** (includes build test):
```bash
npm run devcontainer:validate:full
# or
.devcontainer/validate.sh --full
```

This includes everything in quick validation plus:
- Builds both dev containers (simple + fullstack)
- Requires `devcontainer` CLI: `npm install -g @devcontainers/cli`

**Build only**:
```bash
npm run devcontainer:build           # Build simple config
npm run devcontainer:build:fullstack # Build fullstack config
npm run devcontainer:test            # Validate + build
```

### GitHub Actions CI

Dev Container configurations are automatically tested on:
- **Pull Requests**: Quick validation (JSON, symlinks, file references)
- **Push to main**: Full build test (advisory, non-blocking)
- **Manual trigger**: Via GitHub Actions workflow dispatch

Workflow: `.github/workflows/devcontainer.yml`

**What CI tests:**
1. JSON syntax validation
2. YAML syntax validation
3. Symlink verification
4. Required field checks
5. Referenced file existence
6. Variable resolution (devcontainer CLI)
7. Container builds (on main branch only)

### What Gets Tested

| Test | PR | Main | Local |
|------|----:|-----:|------:|
| JSON syntax | ✓ | ✓ | ✓ |
| YAML syntax | ✓ | ✓ | ✓ |
| Symlink config | ✓ | ✓ | ✓ |
| Required fields | ✓ | ✓ | ✓ |
| File references | ✓ | ✓ | ✓ |
| Docker Compose merge | ✓ | ✓ | ✓ |
| Variable resolution | ✓ | ✓ | ✓ |
| Container build | - | ✓ | ✓ |
| npm install | - | - | ✓ |
| npm run dev:build | - | - | ✓ |
