# KAIROS CLI

The KAIROS CLI lets you manage memories and run protocol chains from the
command line. It connects to any running KAIROS server over HTTP.

## Installation

Install the CLI globally with npm. Node.js 24 or later is required.

```bash
npm install -g @debian777/kairos-mcp
```

Verify the installation:

```bash
kairos --help
```

## Configuration

The CLI connects to a KAIROS server. Set the server URL with the `--url`
flag or the `KAIROS_API_URL` environment variable.

```bash
# Per-command flag
kairos --url http://localhost:3000 search "query"

# Session-wide environment variable
export KAIROS_API_URL=http://localhost:3000
```

The default URL is `http://localhost:3000`.

## Commands

### search — find protocols

Search for protocols by query. Returns a list of matches; use a choice's
URI with `begin` to start that protocol.

```bash
kairos search "ai coding standards"
kairos search "natural language translator"
```

### begin — start a protocol

Load the first step of a protocol chain. Pass a URI from `search` results.
Step 1 requires no solution.

```bash
kairos begin kairos://mem/<step1-uuid>
```

### next — advance a protocol

Get the next step in a protocol chain.

```bash
# Single step, markdown output (default)
kairos next kairos://mem/<step-uuid>

# Follow the entire chain until completion
kairos next kairos://mem/<step-uuid> --follow

# Full JSON response
kairos next kairos://mem/<step-uuid> --output json

# With a solution (required for steps 2 and later)
kairos next kairos://mem/<step-uuid> \
  --solution '{"type":"shell","shell":{"exit_code":0,"stdout":"..."}}'
```

**Options:**

- `--follow` — follow all steps until the chain completes
- `--output <format>` — `md` (default) or `json`
- `--solution <json>` — solution matching the step's challenge type

### mint — store a new document

Store a new markdown document in KAIROS.

```bash
kairos mint document.md
kairos mint document.md --model "gpt-4"
kairos mint document.md --model "gpt-4" --force
```

**Options:**

- `--model <model>` — LLM model ID for attribution (for example, `gpt-4`)
- `--force` — overwrite if a chain with the same label already exists

### update — update memories

Update one or more KAIROS memories.

```bash
# Single memory from a file
kairos update kairos://mem/xxx --file updated.md

# Multiple memories, same file
kairos update kairos://mem/xxx kairos://mem/yyy --file updated.md

# Multiple memories, one file each
kairos update kairos://mem/xxx kairos://mem/yyy \
  --files file1.md file2.md

# Update with a JSON object
kairos update kairos://mem/xxx --updates '{"text":"new content"}'
```

**Options:**

- `--file <file>` — markdown file to apply to all specified URIs
- `--files <files...>` — one file per URI (count must match URI count)
- `--updates <json>` — updates object as a JSON string

### delete — delete memories

Delete one or more KAIROS memories.

```bash
kairos delete kairos://mem/xxx
kairos delete kairos://mem/xxx kairos://mem/yyy kairos://mem/zzz
```

### attest — record step completion

Record success or failure for a protocol step.

```bash
kairos attest kairos://mem/xxx success "Protocol completed"
kairos attest kairos://mem/xxx failure "Step failed"
kairos attest kairos://mem/xxx success "Great work!" \
  --quality-bonus 5 --model "gpt-4"
```

**Options:**

- `--quality-bonus <number>` — additional quality bonus (default: `0`)
- `--model <model>` — LLM model ID for attribution

## Examples

These commands show a common end-to-end workflow. Replace
`kairos://mem/xxx` with a URI from `kairos search` or `kairos begin`.

```bash
kairos search "coding standards"
kairos begin kairos://mem/xxx
kairos next kairos://mem/xxx --follow
kairos mint my-protocol.md --model "claude-3" --force
kairos update kairos://mem/xxx --file updated-content.md
kairos delete kairos://mem/xxx
kairos attest kairos://mem/xxx success "All steps completed"
```

## Troubleshooting

**`kairos: command not found`** — confirm Node.js 24 or later is installed
(`node --version`), then re-run `npm install -g @debian777/kairos-mcp`.

**`ECONNREFUSED` or connection errors** — confirm the KAIROS server is
running and that `KAIROS_API_URL` (or `--url`) points to the correct
address.

**`404 Not Found` on a URI** — the memory may have been deleted. Run
`kairos search` to find current URIs.

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

- Run the KAIROS server: see the [README](../README.md) quick start.
- Connect KAIROS to Cursor: [Install KAIROS MCP in Cursor](INSTALL-MCP.md).
- Understand the protocol flow:
  [Architecture and protocol workflows](architecture/README.md).
- See challenge types:
  [Protocol examples and challenge types](examples/README.md).
