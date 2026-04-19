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

The package also installs the **`kairos-mcp`** command (same binary as **`kairos`**).

## Run the MCP server (`serve`)

Start the KAIROS server process (same as `node dist/bootstrap.js`). Transport resolution:

1. **`--transport stdio|http`** (highest priority)
2. **`TRANSPORT_TYPE`** in the environment
3. **Default `stdio`** when neither is set (only for this command; other CLI commands ignore this default)

Examples:

```bash
kairos serve
TRANSPORT_TYPE=http kairos serve
TRANSPORT_TYPE=http kairos serve --transport stdio
kairos serve --transport http
```

Equivalent:

```bash
kairos-mcp serve --transport stdio
```

With **`npx`** (Node 25+):

```bash
npx -y @debian777/kairos-mcp serve --transport stdio
```

Set **`QDRANT_URL`**, **`QDRANT_COLLECTION`**, and an embedding backend (e.g. **`OPENAI_API_KEY`**) as for any server run.

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

When keyring storage is active, `config.json` keeps non-secret sentinels:

```json
{
  "defaultUrl": "http://localhost:3300",
  "environments": {
    "http://localhost:3300": {
      "bearerToken": "__KEYCHAIN__",
      "refreshToken": "__KEYCHAIN__"
    }
  }
}
```

The `__KEYCHAIN__` marker means the secret is stored in the OS keychain and
must be resolved from there at runtime. The marker itself is never used as an
HTTP bearer token.

**If absent:** Run `kairos login` (browser PKCE or `kairos login --token <token>`).
The CLI writes tokens (and API URL) to the keyring or, on fallback, to that
config file so MCP hosts can use it too.

**Refresh tokens:** After **browser PKCE** login, the CLI also stores a refresh
token when the IdP returns one (same keyring / file rules as the access token,
with a separate keyring entry). On **401**, the CLI refreshes the access token
before opening the browser again. If the JWT access token is within about **60
seconds** of expiry, the CLI refreshes proactively to reduce spurious 401s.

**`kairos login --token`:** Stores **only** the access token you pass; any
previously stored refresh token is **cleared**, so later 401 handling will use
browser login (unless you run full PKCE login again).

Token storage behavior is:

1. **OS keyring first** when available
2. **config-file fallback** when keyring access is unavailable or fails

Copying `config.json` to another machine does not copy keychain secrets. A file
that only contains `__KEYCHAIN__` entries will not authenticate unless matching
keychain items exist on that machine.

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

This validates the token with `GET /api/me` before storing it. It does **not**
obtain or store a refresh token.

### Logout and token inspection

```bash
kairos logout
kairos token
kairos token --validate
kairos token --login
```

- `logout` clears the stored access and refresh credentials for the current API URL
- `token` prints the stored token to stdout
- `token --validate` checks it with `GET /api/me`
- `token --login` performs browser login first if no token exists

## Commands

### `activate`

Match stored adapters for a user phrasing (plain-text query).

```bash
kairos activate ai coding standards
```

This calls `POST /api/activate` and prints the JSON response (choices and
`next_action`).

### `forward`

Run the first or next adapter layer. For a **new** run, pass an **adapter** URI
from **`activate`** and **omit** `--solution`. For later steps, pass the
**layer** URI from the prior response (include `?execution_id=` when the server
returned one) and a `--solution` JSON object whose `type` matches the current
`contract`.

```bash
kairos forward kairos://adapter/<uuid>
kairos forward 'kairos://layer/<uuid>?execution_id=<id>' --solution '{"type":"comment","comment":{"text":"done"}}'
```

### `train`

Register one adapter from a markdown file, or many from a directory of `.md`
files.

```bash
kairos train adapter.md --model "gpt-4.1"
kairos train adapter.md --model "gpt-4.1" --force
kairos train ./bundle --force
kairos train ./bundle --force --recursive
```

Options:

- `--model <model>` — sent as `llm_model_id` (required for single-file train)
- `--force` — replace an existing adapter with the same label when allowed
- `--recursive` — when the path is a directory, include nested `.md` files

Directory-batch behavior:

- non-recursive by default
- skips files whose basename is exactly `README.md`
- prints one JSON batch object with per-file results

### `tune`

Update one or more adapter or layer URIs.

```bash
kairos tune kairos://adapter/<uuid> --file updated.md
kairos tune kairos://layer/<a> kairos://layer/<b> --files a.md b.md
kairos tune kairos://layer/<uuid> --updates '{"text":"new content"}'
```

Use one of:

- `--file`
- `--files` (one path per URI)
- `--updates`

### `delete`

Delete one or more adapters or layers by URI.

```bash
kairos delete kairos://adapter/<uuid>
kairos delete kairos://layer/<a> kairos://layer/<b>
```

### `reward`

Attach a reward outcome to the **final layer** URI for a completed run (see tool
docs for `execution_id` when applicable).

```bash
kairos reward kairos://layer/<uuid> success "Completed successfully"
kairos reward 'kairos://layer/<uuid>?execution_id=<id>' failure "Validation failed"
```

Options:

- `--score <number>` — normalized score in `0..1`
- `--rater <id>` — evaluator identifier
- `--rubric-version <version>`
- `--model <model>` — `llm_model_id` for attribution

### `export`

Export an adapter or layer as markdown or training JSONL.

```bash
kairos export kairos://adapter/<uuid>
kairos export kairos://layer/<uuid> --format reward_jsonl --output json
```

Options:

- `--format` — `markdown` (default), `trace_jsonl`, `reward_jsonl`,
  `sft_jsonl`, or `preference_jsonl`
- `--output` — `text` (default) for raw content, or `json` for the full API response

## Common flows

### Activate → forward (loop) → reward

```bash
kairos activate "release checklist"
kairos forward kairos://adapter/<uuid>
kairos forward 'kairos://layer/<step-uuid>?execution_id=<id>' --solution '{"type":"comment","comment":{"text":"done"}}'
kairos reward 'kairos://layer/<last-layer-uuid>?execution_id=<id>' success "Run completed"
```

### Batch train a bundle

```bash
kairos train ./adapters --force --recursive
```

## Run from this repo against the local dev server

After the local dev server is ready (port from `.env` `PORT`, commonly `3300` in the template):

```bash
npm run dev:cli-ready
npm run cli:dev -- activate "test"
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
one host/port pair (for example `http://localhost:3300`) is different from a token for another (for example `http://localhost:3000`).

## Related docs

- [Install index](install/README.md)
- [Environment variables and secrets](install/env-and-secrets.md)
- [Cursor and MCP](install/README.md#cursor-and-mcp)
- [Architecture](architecture/README.md)
- [Adapter examples](examples/README.md)
