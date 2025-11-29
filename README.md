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

## CLI Usage

The KAIROS CLI provides a command-line interface for interacting with the KAIROS REST API.

### Installation

After building the project, the CLI is available as the `kairos` command:

```bash
npm run build
node dist/cli/index.js --help
```

Or use it directly if installed globally or via npm link.

### Configuration

The CLI connects to the KAIROS API server. Configure the API URL using:

- `--url` flag: `kairos --url http://localhost:3000 <command>`
- `KAIROS_API_URL` environment variable: `export KAIROS_API_URL=http://localhost:3000`

Default API URL: `http://localhost:3000`

### Commands

#### `begin` - Search for Protocols

Search for KAIROS protocols by query:

```bash
kairos begin "ai coding standards"
kairos begin "natural language translator"
```

#### `next` - Get Next Step

Get the next step in a KAIROS protocol chain:

```bash
# Get single step (markdown output, default)
kairos next kairos://mem/00000000-0000-0000-0000-000000000001

# Follow entire chain until completion
kairos next kairos://mem/00000000-0000-0000-0000-000000000001 --follow

# Get full JSON response
kairos next kairos://mem/00000000-0000-0000-0000-000000000001 --output json

# Follow chain with JSON output
kairos next kairos://mem/00000000-0000-0000-0000-000000000001 --follow --output json

# With proof of work result
kairos next kairos://mem/xxx --proof-of-work '{"exit_code":0,"stdout":"..."}'
```

**Options:**
- `--follow`: Follow all URLs in the chain until completion
- `--output <format>`: Output format - `md` (markdown content only, default) or `json` (full response)
- `--proof-of-work <json>`: Proof of work result as JSON string (for steps requiring proof)

#### `mint` - Store New Document

Store a new markdown document in KAIROS:

```bash
kairos mint document.md
kairos mint document.md --model "gpt-4"
kairos mint document.md --model "gpt-4" --force
```

**Options:**
- `--model <model>`: LLM model ID for attribution (e.g., "gpt-4", "claude-3")
- `--force`: Force update if a memory chain with the same label already exists

#### `update` - Update Memories

Update one or more KAIROS memories:

```bash
# Update single memory with a file
kairos update kairos://mem/xxx --file updated.md

# Update multiple memories with same file
kairos update kairos://mem/xxx kairos://mem/yyy --file updated.md

# Update multiple memories with different files
kairos update kairos://mem/xxx kairos://mem/yyy --files file1.md file2.md

# Update with JSON updates object
kairos update kairos://mem/xxx --updates '{"text":"new content"}'
```

**Options:**
- `--file <file>`: Path to markdown file to apply to all specified URIs
- `--files <files...>`: Paths to markdown files, one per URI (must match number of URIs)
- `--updates <json>`: Updates object as JSON string (alternative to --file/--files)

#### `delete` - Delete Memories

Delete one or more KAIROS memories:

```bash
kairos delete kairos://mem/xxx
kairos delete kairos://mem/xxx kairos://mem/yyy kairos://mem/zzz
```

#### `attest` - Attest Step Completion

Attest completion or failure of a KAIROS protocol step:

```bash
kairos attest kairos://mem/xxx success "Protocol completed successfully"
kairos attest kairos://mem/xxx failure "Step failed due to error"
kairos attest kairos://mem/xxx success "Great work!" --quality-bonus 5 --model "gpt-4"
```

**Options:**
- `--quality-bonus <number>`: Additional quality bonus to apply (default: 0)
- `--model <model>`: LLM model ID for attribution (e.g., "gpt-4", "claude-3")

### Examples

```bash
# Search for a protocol
kairos begin "coding standards"

# Follow a protocol chain and output markdown
kairos next kairos://mem/xxx --follow

# Store a new protocol document
kairos mint my-protocol.md --model "claude-3" --force

# Update an existing memory
kairos update kairos://mem/xxx --file updated-content.md

# Delete a memory
kairos delete kairos://mem/xxx

# Attest protocol completion
kairos attest kairos://mem/xxx success "All steps completed"
```

### Help

Get help for any command:

```bash
kairos --help
kairos begin --help
kairos next --help
kairos mint --help
kairos update --help
kairos delete --help
kairos attest --help
```

## Snapshot Management

- Enable automatic Qdrant backups on boot by setting `QDRANT_SNAPSHOT_ON_START=true`. Use `QDRANT_SNAPSHOT_DIR` to control where snapshot files are written (defaults to `data/qdrant/snapshots`).
- Trigger an on-demand snapshot against the running server with `POST /api/snapshot`. The response includes the snapshot file path, byte size, and status so you can plug it into backup automation.

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

