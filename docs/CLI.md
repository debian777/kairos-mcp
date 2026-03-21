# KAIROS CLI

The `kairos` CLI talks to a running KAIROS server over HTTP.

## Install

Node.js 25 or later is required.

```bash
npm install -g @debian777/kairos-mcp
kairos --help
```

Run once without global installation:

```bash
npx @debian777/kairos-mcp --help
```

## Select the server URL

The CLI resolves the API base URL in this order:

1. `--url`
2. `KAIROS_API_URL`
3. the default URL stored in the shared CLI config
4. fallback: `http://localhost:3000`

Examples:

```bash
kairos --url http://localhost:3000 search "release checklist"
export KAIROS_API_URL=http://localhost:3000
kairos search "release checklist"
```

## Authentication

When the server requires auth, the CLI uses a stored Bearer token.

### Storage model

The CLI and MCP hosts share the same local config path:

- Unix: `$XDG_CONFIG_HOME/kairos/config.json`
- fallback Unix: `~/.config/kairos/config.json`
- Windows: `%APPDATA%\kairos\config.json`

**Token read:** The CLI reads the token from the keyring when available,
otherwise from the paths above. Bearer tokens are **not** read from process
environment variables; use `kairos login` and the shared config file.

**If absent:** Run `kairos login` (browser PKCE or `kairos login --token <token>`).
The CLI writes the token (and API URL) to the keyring or, on fallback, to that
config file so MCP hosts can use it too.

Token storage behavior is:

1. **OS keyring first** when available
2. **config-file fallback** when keyring access is unavailable or fails

### Login methods

#### Browser PKCE login

```bash
kairos login
```

The CLI:

- discovers auth endpoints from `/.well-known/oauth-protected-resource`
- uses the public client ID `kairos-cli`
- binds a local callback port
- exchanges the code for an access token
- stores the token for the current API URL

If you do not want the browser to open automatically:

```bash
kairos login --no-browser
```

To pin the callback port:

```bash
export KAIROS_LOGIN_CALLBACK_PORT=38123
kairos login
```

#### Store an existing token

```bash
kairos login --token <bearer-token>
```

This validates the token with `GET /api/me` before storing it.

### Logout and token inspection

```bash
kairos logout
kairos token
kairos token --validate
kairos token --login
```

- `logout` clears the stored token for the current API URL
- `token` prints the stored token to stdout
- `token --validate` checks it with `GET /api/me`
- `token --login` performs browser login first if no token exists

## Commands

### `search`

Search for protocols.

```bash
kairos search "ai coding standards"
```

This calls `POST /api/kairos_search` and prints the JSON response.

### `begin`

Start a protocol from a URI or an exact protocol slug.

```bash
kairos begin kairos://mem/<uuid>
kairos begin --key create-new-protocol
```

If both a URI and `--key` are supplied, the CLI sends the URI.

### `next`

Advance a protocol step.

```bash
kairos next kairos://mem/<uuid> --solution '{"type":"comment","comment":{"text":"done"}}'
kairos next kairos://mem/<uuid> --output json
```

Options:

- `--solution <json>` — send the solution payload
- `--output md|json` — markdown content only (`md`) or full JSON (`json`)
- `--follow` — keep following `next_action` URIs until the response no longer
  points to `kairos_next`

`--follow` does **not** generate solutions for later steps. It only reuses the
response flow, so it is useful only when the later steps do not need new manual
input or when you are intentionally exploring the raw flow.

### `mint`

Mint one markdown file or a directory of markdown files.

```bash
kairos mint protocol.md --model "gpt-4.1"
kairos mint protocol.md --model "gpt-4.1" --force
kairos mint ./bundle --force
kairos mint ./bundle --force --recursive
```

Options:

- `--model <model>` — value sent as `llm_model_id`
- `--force` — overwrite an existing chain with the same title/label
- `--recursive` — recurse into subdirectories when the argument is a directory
- `--fail-fast` — stop the batch after the first mint failure

Directory-batch behavior:

- non-recursive by default
- skips files whose basename is exactly `README.md`
- prints one JSON batch object with per-file results

### `update`

Update one or more memories.

```bash
kairos update kairos://mem/<uuid> --file updated.md
kairos update kairos://mem/<a> kairos://mem/<b> --files a.md b.md
kairos update kairos://mem/<uuid> --updates '{"text":"new content"}'
```

Use either:

- `--file`
- `--files`
- `--updates`

### `delete`

Delete one or more memories.

```bash
kairos delete kairos://mem/<uuid>
kairos delete kairos://mem/<a> kairos://mem/<b>
```

### `attest`

Record success or failure after the last protocol step.

```bash
kairos attest kairos://mem/<uuid> success "Completed successfully"
kairos attest kairos://mem/<uuid> failure "Validation failed" --quality-bonus 2
```

Options:

- `--quality-bonus <number>`
- `--model <model>`

## Common flows

### Search -> begin -> next -> attest

```bash
kairos search "release checklist"
kairos begin kairos://mem/<uuid>
kairos next kairos://mem/<step-uuid> --solution '{"type":"comment","comment":{"text":"done"}}'
kairos attest kairos://mem/<last-step-uuid> success "Run completed"
```

### Batch mint a bundle

```bash
kairos mint ./protocols --force --recursive
```

## Run from this repo against the local dev server

After the local dev server is ready on port `3300`:

```bash
npm run dev:cli-ready
npm run cli:dev -- search "test"
```

`npm run dev:cli-ready` performs an auth-ready check for the local dev setup.

## Troubleshooting

### `kairos: command not found`

Check Node.js version and reinstall:

```bash
node --version
npm install -g @debian777/kairos-mcp
```

### Connection refused / timeout

Verify the target server:

```bash
curl http://localhost:3000/health
```

Also confirm you are using the intended `--url` or `KAIROS_API_URL`.

### The CLI says authentication is required

Run:

```bash
kairos login
```

or store an existing token:

```bash
kairos login --token <bearer-token>
```

### A stored token is not being used

Remember that tokens are stored per normalized API base URL. A token for
`http://localhost:3300` is different from a token for `http://localhost:3000`.

## Related docs

- [Install and environment](install/README.md)
- [Install KAIROS MCP in Cursor](INSTALL-MCP.md)
- [Architecture](architecture/README.md)
- [Protocol examples](examples/README.md)
