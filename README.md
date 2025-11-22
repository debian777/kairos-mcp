# KAIROS MCP Server

AI Knowledge Memory System for AI Agent Consciousness Infrastructure

## Build, Deploy, and Test

All build, deploy, and test operations are available as npm scripts.

**⚠️ IMPORTANT: Always deploy before testing.** Tests run against running dev/qa servers, so you must deploy your changes first using `npm run dev:deploy` (or `npm run qa:deploy`) before running tests.

### Build

```bash
# Build TypeScript to JavaScript (outputs to dist/)
npm run build

# Build for development environment (includes linting)
npm run dev:build

# Build for QA environment (includes linting)
npm run qa:build
```

### Deploy

```bash
# Deploy to development environment (build + restart)
npm run dev:deploy

# Deploy to QA environment (build + start)
npm run qa:deploy
```

### Test

**⚠️ REQUIRED: Deploy before testing.** Tests require the server to be running with your latest changes.

```bash
# Standard workflow: Deploy first, then test
npm run dev:deploy && npm run dev:test
npm run qa:deploy && npm run qa:test

# Individual test commands (only use if server is already deployed)
npm run dev:test
npm run qa:test
```

**Why deploy first?** Tests connect to the running MCP server. If you've made code changes, you must deploy them (`npm run dev:deploy`) so the server runs your updated code before tests execute.

### Development Environment Management

```bash
# Start development server
npm run dev:start

# Stop development server
npm run dev:stop

# Restart development server
npm run dev:restart

# View development logs
npm run dev:logs

# Check development server status
npm run dev:status

# Access Redis CLI (development)
npm run dev:redis-cli

# Access Qdrant via curl (development)
npm run dev:qdrant-curl
```

### QA Environment Management

```bash
# Start QA server
npm run qa:start

# Stop QA server
npm run qa:stop

# Restart QA server
npm run qa:restart

# View QA logs
npm run qa:logs

# Check QA server status
npm run qa:status

# Access Redis CLI (QA)
npm run qa:redis-cli

# Access Qdrant via curl (QA)
npm run qa:qdrant-curl
```

### Code Quality

```bash
# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix

# Verify clean source (checks for uncommitted changes)
npm run verify:clean
```

### Docker

```bash
# Build Docker image
npm run docker:build
```

## Project Structure

- `src/` - Source TypeScript code
- `src/embed-docs/` - Embedded MCP resources (prompts, tools, templates)
- `dist/` - Compiled JavaScript output
- `tests/` - Test files
- `tests/test-data/` - Test data files
- `scripts/` - Build and utility scripts

## Requirements

- Node.js >= 24.0.0
- Docker (for containerized deployment)
- Qdrant (vector database)
- Redis (caching)

## License

MIT

