# KAIROS CLI

The KAIROS CLI provides a command-line interface for interacting with the KAIROS REST API.

## Installation

Since this is a private package, install the CLI locally using one of these methods:

### Option 1: npm link (Recommended for Development)

```bash
# Build the project first
npm run build

# Link the package globally (makes 'kairos' command available)
npm link

# Verify installation
kairos --help
```

After linking, the `kairos` command is available system-wide and you can run it from any directory.

### Option 2: Direct Execution

```bash
# Build the project
npm run build

# Run CLI directly
node dist/cli/index.js --help
node dist/cli/index.js begin "query"
```

### Option 3: Create a Shell Alias

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias kairos='node /path/to/kairos-mcp/dist/cli/index.js'
```

Then reload your shell:

```bash
source ~/.zshrc  # or source ~/.bashrc
```

### Option 4: Add to PATH

```bash
# Build the project
npm run build

# Add to PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="$PATH:/path/to/kairos-mcp/dist/cli"

# Or create a symlink
ln -s /path/to/kairos-mcp/dist/cli/index.js /usr/local/bin/kairos
```

> **Note:** After any code changes, rebuild with `npm run build` to update the CLI.

## Configuration

The CLI connects to the KAIROS API server. Configure the API URL using:

- `--url` flag: `kairos --url http://localhost:3000 <command>`
- `KAIROS_API_URL` environment variable: `export KAIROS_API_URL=http://localhost:3000`

Default API URL: `http://localhost:3000`

## Commands

### `search` - Search for Protocols

Search for KAIROS protocols by query. Returns a list of choices (matches, refine, create); use a choice's URI with `begin` to start a protocol.

```bash
kairos search "ai coding standards"
kairos search "natural language translator"
```

### `begin` - Start Protocol (Step 1)

Load the first step of a protocol chain. Pass a URI from `search` results (or a step 1 URI). No solution is required for step 1.

```bash
kairos begin kairos://mem/<step1-uuid>
```

### `next` - Get Next Step

Get the next step in a KAIROS protocol chain:

```bash
# Get single step (markdown output, default)
kairos next kairos://mem/<step-uuid>

# Follow entire chain until completion
kairos next kairos://mem/<step-uuid> --follow

# Get full JSON response
kairos next kairos://mem/<step-uuid> --output json

# Follow chain with JSON output
kairos next kairos://mem/<step-uuid> --follow --output json

# With solution (proof of work)
kairos next kairos://mem/<step-uuid> --solution '{"type":"shell","shell":{"exit_code":0,"stdout":"..."}}'
```

**Options:**

- **`--follow`**: Follow all URLs in the chain until completion
- **`--output`** `<format>`: Output format — `md` (markdown content only, default) or `json` (full response)
- **`--solution`** `<json>`: Solution matching the step's challenge (for steps 2+)

### `mint` - Store New Document

Store a new markdown document in KAIROS:

```bash
kairos mint document.md
kairos mint document.md --model "gpt-4"
kairos mint document.md --model "gpt-4" --force
```

**Options:**

- **`--model`** `<model>`: LLM model ID for attribution (for example, "gpt-4", "claude-3")
- **`--force`**: Force update if a memory chain with the same label already exists

### `update` - Update Memories

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

- **`--file`** `<file>`: Path to markdown file to apply to all specified URIs
- **`--files`** `<files...>`: Paths to markdown files, one per URI (must match number of URIs)
- **`--updates`** `<json>`: Updates object as JSON string (alternative to --file/--files)

### `delete` - Delete Memories

Delete one or more KAIROS memories:

```bash
kairos delete kairos://mem/xxx
kairos delete kairos://mem/xxx kairos://mem/yyy kairos://mem/zzz
```

### `attest` - Attest Step Completion

Attest completion or failure of a KAIROS protocol step:

```bash
kairos attest kairos://mem/xxx success "Protocol completed successfully"
kairos attest kairos://mem/xxx failure "Step failed due to error"
kairos attest kairos://mem/xxx success "Great work!" --quality-bonus 5 --model "gpt-4"
```

**Options:**

- **`--quality-bonus`** `<number>`: Additional quality bonus to apply (default: 0)
- **`--model`** `<model>`: LLM model ID for attribution (for example, "gpt-4", "claude-3")

## Examples

The following commands show common workflows. Replace `kairos://mem/xxx` with a
memory URI from `kairos search` (choices) or `kairos begin` / `kairos next`.

```bash
# Search for a protocol
kairos search "coding standards"

# Start a protocol (use a URI from search results)
kairos begin kairos://mem/xxx

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

## Help

Get help for any command:

```bash
kairos --help
kairos search --help
kairos begin --help
kairos next --help
kairos mint --help
kairos update --help
kairos delete --help
kairos attest --help
```

## Next steps

- Set up and run the KAIROS server: see the project [README](../README.md) for quick start (Docker or developer option); see [CONTRIBUTING](../CONTRIBUTING.md) for full developer commands.
- Install the KAIROS MCP server in Cursor: [Install KAIROS MCP in Cursor](INSTALL-MCP.md).
- For protocol flow and tool workflows: [Architecture and protocol workflows](architecture/README.md).
- For challenge types and protocol examples: [Protocol examples and challenge types](examples/README.md).
