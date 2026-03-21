# KAIROS CLI

The KAIROS CLI lets you manage memories and run protocol chains from the
command line. It connects to any running KAIROS server over HTTP.

## Installation

Install the CLI globally with npm. Node.js 25 or later is required.

```bash
npm install -g @debian777/kairos-mcp
```

Verify the installation:

```bash
kairos --help
```

**Run from repo (dev server on port 3300):**

1. One-time: start dev server (`npm run dev:start`), then run `npm run dev:cli-ready`. Complete login in the browser when it opens. Script exits 0 and prints `OK` when search works.
2. Then use:
   ```bash
   npm run cli:dev -- search "test"
   ```
   Or with explicit URL: `npm run cli -- --url http://localhost:3300 search "test"`.

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

## Authentication

When the server has authentication enabled, requests must include a Bearer token.

**Shared config (CLI and MCP):** Both read the token from the same config file; if absent, perform auth and save to that file.

**Token storage:** The CLI tries the OS keyring first; if the keyring is unavailable or a keyring operation fails, it falls back to the config file under `$XDG_CONFIG_HOME/kairos` (or `~/.config/kairos` / `%APPDATA%\\kairos` on Windows). This applies to all users, not only CI.

1. **Token read:** The CLI reads the token from the keyring when available, otherwise from `$XDG_CONFIG_HOME/kairos/config.json` (or `%APPDATA%\\kairos\\config.json` on Windows). The CLI does **not** use the `KAIROS_BEARER_TOKEN` environment variable.
2. **If absent:** Run `kairos login` (browser PKCE or `kairos login --token <token>`). The CLI writes the token (and API URL) to the keyring or, on fallback, to that config file so MCP hosts can use it too.

The config file is created by `kairos login` and is user-only readable (`0o600`); do not commit it (it contains secrets). It supports **multiple environments** keyed by API URL: each URL (e.g. `http://localhost:3300`, `https://api.kairos.example.com`) can have its own token. Format: `{ "defaultUrl": "<url>", "environments": { "<url>": { "bearerToken": "..." }, ... } }`. The default environment is used when `--url` and `KAIROS_API_URL` are not set; `kairos logout` clears the token for the current URL.

When a command fails because authentication is required, the CLI prints the login URL
and **opens it in your browser by default**. Use **`--no-browser`** to disable (e.g. in scripts or tests). Browser-based
`kairos login` uses a local callback server so the CLI can receive the token; the
login URL shown on 401 responses points to the server's callback for web sessions.

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

Store a new markdown document in KAIROS. You can pass a single `.md` file, or a
directory. For a directory, the CLI mints every `.md` file in that directory
(non-recursive by default) and prints a JSON batch object. Use `--recursive` to
include `.md` files in subdirectories. If any mint in a batch fails, the CLI
still finishes the rest unless you pass `--fail-fast`; the process exits with
status `1` when at least one file failed.

```bash
kairos mint document.md
kairos mint document.md --model "gpt-4"
kairos mint document.md --model "gpt-4" --force
kairos mint ./my-bundle --force
kairos mint ./my-bundle --force --recursive
```

**Options:**

- `--model <model>` — LLM model ID for attribution (for example, `gpt-4`)
- `--force` — overwrite if a chain with the same label already exists
- `-r, --recursive` — when the path is a directory, include `.md` files in
  subdirectories
- `--fail-fast` — stop after the first mint error in a directory batch (default
  is to continue and report all results)

**Directory batch output:** stdout is a JSON object with `batch: true`, `root`
(resolved directory path), and `results`: an array of per-file outcomes. Each
success entry includes `ok: true`, `status`, and `items` (same shape as a
single-file mint). Each failure includes `ok: false` and `error`.

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

### login — store a Bearer token

Log in and store a token for the current server (env or config base URL).

```bash
# Store a token you already have (validated with GET /api/me)
kairos login --token <your-bearer-token>

# Browser login (PKCE; CLI uses fixed client_id kairos-cli and dynamic callback port)
kairos login

# Print login URL only (no browser); useful for tests or headless automation
kairos login --no-browser
```

**Options:**

- `--token <token>` — validate and store this token; skip browser flow
- `--no-browser` — print the login URL to stdout and do not open a browser

Browser login binds to an open port and sends that callback URL to Keycloak. The callback path includes a per-request token. Set `KAIROS_LOGIN_CALLBACK_PORT` to pin the port (e.g. for tests).

### logout — clear stored token

Remove the stored Bearer token from the config file for the current API URL.
(The CLI does not read token from the environment.)

```bash
kairos logout
```

### token — print stored token (scripting)

Print the stored Bearer token to stdout. Useful for scripts or tools that need
to pass the token to another process.

```bash
# Print token (no validation)
kairos token

# Validate with GET /api/me before printing
kairos token --validate

# If no token, trigger browser login then print
kairos token --login
```

**Options:**

- `-v, --validate` — validate token with `GET /api/me` before printing; exit non-zero if invalid
- `-l, --login` — if no stored token, run browser login and then print the new token

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
kairos mint ./exported-protocols --model "claude-3" --force --recursive
kairos update kairos://mem/xxx --file updated-content.md
kairos delete kairos://mem/xxx
kairos attest kairos://mem/xxx success "All steps completed"
```

## Troubleshooting

**`kairos: command not found`** — confirm Node.js 25 or later is installed
(`node --version`), then re-run `npm install -g @debian777/kairos-mcp`.

**`ECONNREFUSED` or connection errors** — confirm the KAIROS server is
running and that `KAIROS_API_URL` (or `--url`) points to the correct
address.

**`404 Not Found` on a URI** — the memory may have been deleted. Run
`kairos search` to find current URIs.

**`Authentication required`** — the server requires a Bearer token. Run the command
(the CLI opens the login URL by default), or run `kairos login`. See
[Authentication](#authentication).

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
kairos login --help
kairos logout --help
kairos token --help
```

## Next steps

- Run the KAIROS server: see the [README](../README.md) quick start.
- Connect KAIROS to Cursor: [Install KAIROS MCP in Cursor](INSTALL-MCP.md).
- Understand the protocol flow:
  [Architecture and protocol workflows](architecture/README.md).
- See challenge types:
  [Protocol examples and challenge types](examples/README.md).
