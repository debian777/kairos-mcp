---
name: kairos-install
description: >-
  Guide first-time KAIROS installation from the canonical GitHub install docs.
  Also handle maintenance updates for Docker Compose and the npm-distributed
  KAIROS CLI. Check prerequisites, offer to install missing components after
  explicit user approval, help the user choose and configure an embedding
  backend, start the simple Docker stack, and guide CLI authentication when the
  target server requires it.
compatibility: >-
  Requires network access to GitHub and, when installation is approved,
  permission to inspect installed tools, open ports, and the chosen working
  directory; install prerequisites; create or update `.env` next to
  `compose.yaml`; and run Docker Compose plus Node.js 25+ commands.
metadata:
  author: kairos-mcp
  doc-source: github-main
  scope: install-config-auth
---

# kairos-install

Use the GitHub install docs as the canonical source for this skill. Do not rely
on bundled install mirrors or copied snippets when the GitHub docs are
available.

The default path is the simple Docker Compose stack. Use the advanced full
stack only when the user explicitly asks for the operator-managed profile. Do
not treat Keycloak or identity-provider administration as part of the normal
install flow.

## Canonical GitHub docs

Read these pages directly from GitHub before you act:

- Install index:
  https://github.com/debian777/kairos-mcp/blob/main/docs/install/README.md
- Prerequisites:
  https://github.com/debian777/kairos-mcp/blob/main/docs/install/prerequisites.md
- Simple stack:
  https://github.com/debian777/kairos-mcp/blob/main/docs/install/docker-compose-simple.md
- CLI:
  https://github.com/debian777/kairos-mcp/blob/main/docs/CLI.md
- Full stack (advanced):
  https://github.com/debian777/kairos-mcp/blob/main/docs/install/docker-compose-full-stack.md
- Auth overview:
  https://github.com/debian777/kairos-mcp/blob/main/docs/architecture/auth-overview.md

Read the docs in this order:

1. Fetch the listed GitHub `blob/main` page over HTTPS.
2. For reading, copying, or extracting commands, turn the same URL into raw
   Markdown by
   replacing
`https://github.com/debian777/kairos-mcp/blob/main/` with
   `https://raw.githubusercontent.com/debian777/kairos-mcp/main/`.
3. If GitHub fetches are unavailable, tell the user and use the local fallback
   paths listed below.

Do not treat this link list as informational only.

For this skill, a GitHub fetch counts as successful only when you receive the
page or raw Markdown with HTTP 200 and usable content. Treat non-200 responses,
network errors, or empty bodies as fetch failure.

Raw URL example:

- page:
  `https://github.com/debian777/kairos-mcp/blob/main/docs/install/README.md`
- raw:
  `https://raw.githubusercontent.com/debian777/kairos-mcp/main/docs/install/README.md`

Extraction rule for `.env` blocks:

- open raw `docs/install/docker-compose-simple.md`
- go to `## 3. Environment file`
- choose the matching backend subsection
- copy only the fenced `ini` block directly under that subsection

Mini example:

1. open raw `docs/install/docker-compose-simple.md`
2. find `## 3. Environment file`
3. if the user chose OpenAI, go to `### OpenAI`
4. copy only the next fenced `ini` block

If GitHub is unavailable, tell the user before falling back to local checked-out
copies.

If the GitHub `main` docs and the local checked-out docs disagree, call out the
mismatch before continuing. Use GitHub as the default source for this skill,
but do not write `.env`, run commands, or choose values until the user confirms
whether to follow GitHub or the local checkout.

Local fallback paths for the same docs are:

- `docs/install/README.md`
- `docs/install/prerequisites.md`
- `docs/install/docker-compose-simple.md`
- `docs/CLI.md`
- `docs/install/docker-compose-full-stack.md`
- `docs/architecture/auth-overview.md`

Treat those paths as relative to the repo root. Example: if the repo root is
`/work/kairos-mcp`, then the install index fallback path is
`/work/kairos-mcp/docs/install/README.md`.

## Major decision gates

Consult the user before any material change. Use direct yes/no or short-option
questions, not vague prompts.

Treat these as material changes: installing software, downloading
`compose.yaml`, writing or overwriting `.env`, pulling models, starting or
stopping containers, running login commands that open a browser or store
tokens, and writing MCP host configuration.

Resolve these decisions explicitly:

1. Which working directory contains `compose.yaml`?
2. Which embedding backend should the install use: OpenAI, Ollama, or TEI?
3. Which embedding model should be used?
4. When a prerequisite is missing, install it now or wait?
5. If the target server requires auth, use browser login or token login?
6. Does the host actually need MCP configuration, or is the CLI enough?

For this skill, "advanced full stack" or "operator-managed profile" means the
Compose deployment that adds supporting services such as Redis, Postgres, and
Keycloak beyond the default app + Qdrant path.

Treat requests for Redis, Postgres, SSO, Keycloak, or "full stack" as requests
for this advanced path.

Treat CLI as enough unless the user explicitly wants an IDE or another MCP host
to connect over HTTP. If the task is only install, health verification, login,
or normal CLI usage, skip MCP configuration.

## Must always

Apply these rules on every install run:

- Start by reading the GitHub install index, prerequisites, simple stack, and
  CLI docs.
- Check whether required local components already exist before installing
  anything.
- Identify missing components precisely: Docker, Docker Compose v2, Node.js
  25+, `kairos` CLI or `npx`, a writable `.env` location, and Ollama only when
  the Ollama path is selected.
- When a prerequisite is missing and the user approves the fix, install it
  instead of only describing the next step.
- Use the simple stack as the default recommendation.
- Use the GitHub docs to build the exact `.env` block for the chosen backend.
- Confirm the target path before creating or overwriting `.env`.
- Set `AUTH_ENABLED=false` for the default simple stack.
- Guide the user through CLI authentication when auth is enabled on the chosen
  server.
- Explain the next blocking issue when the install cannot continue.
- If the user declines an installation step, explain what remains blocked and
  wait.

## Must never

Apply these prohibitions on every install run:

- Never choose an embedding backend or model without consulting the user.
- Never install Docker, Node.js, Ollama, or the CLI without a yes/no approval.
- Never overwrite `.env`, pull Ollama models, or start containers without
  confirmation.
- Never invent API keys, tokens, service URLs, or other secrets.
- Never treat Keycloak or identity-provider configuration as part of the
  standard install.
- Never use a chat model for embeddings.
- Never depend on `references/README.md` or
  `docs/install/env-and-secrets.md` for the main flow.
- Never continue past a missing prerequisite if the user has not approved the
  fix.

## Workflow

Follow this sequence so the install stays ordered and auditable.

### 0. Classify the request

Classify the user request before taking action:

- **Install mode:** first-time setup, bootstrap, or environment bring-up
- **Update mode:** Docker or npm CLI refresh, version bump, or maintenance

If unclear, ask the user whether they want install mode or update mode.

When the user asks for Docker and npm CLI updates, skip backend and `.env`
selection unless they also ask to reconfigure the runtime.

### 1. Read the canonical docs

Read the GitHub install index, prerequisites, simple stack, and CLI docs
first. If GitHub is unavailable, tell the user before using local checked-out
copies.

### 2. Audit prerequisites

Confirm that the user has:

- Docker Engine and Docker Compose v2
- a working directory with `compose.yaml` and a writable `.env`
- Node.js 25 or later
- the `kairos` CLI, or willingness to use `npx`
- Ollama only if the Ollama backend is selected

Remember that a local `git clone` is optional. The user only needs a controlled
copy of `compose.yaml` plus a writable `.env` path. Accept either the checked-
out repo root `compose.yaml` or a downloaded copy from:
https://raw.githubusercontent.com/debian777/kairos-mcp/main/compose.yaml

For this skill, a "controlled copy" means the checked-out repo file or a raw
download from the GitHub URL above placed into a user-approved working
directory.

When something is missing, say exactly what is missing and ask whether to
install it now.

Known CLI install command:

```bash
npm install -g @debian777/kairos-mcp
kairos --help
```

Known one-shot `npx` command:

```bash
npx @debian777/kairos-mcp --help
```

If the user declines a global install, keep using `npx @debian777/kairos-mcp
<command>` for the rest of the session.

Compose v2 verification commands:

```bash
docker compose version
docker-compose version
```

Treat `docker compose version` as the required success case. If only
`docker-compose` works and `docker compose` does not, tell the user Compose v2
is missing and ask whether to install or upgrade it.

For Docker, Node.js, or Ollama, use the official vendor installation path for
the user's OS after approval if the KAIROS install docs do not already cover
the missing prerequisite.

For this skill, assume the KAIROS docs cover CLI and Compose usage, but Docker,
Node.js, and Ollama installation steps come from the vendor pages below.

Do not invent your own Docker, Node.js, or Ollama install commands. Use the
official OS-specific instructions from the vendor page after the user approves
that install path.

If the agent cannot run the official installer directly, stop after opening the
vendor page and telling the user what they need to complete manually.

If the OS is not already clear, ask whether the user is on macOS, Windows, or
Linux before opening the vendor page.

On Windows, confirm whether the user wants the install to target Windows itself
or a WSL environment before you continue.

Success checks after installation:

- Docker: `docker --version` and `docker compose version`
- Node.js: `node --version`
- Ollama: `ollama --version` or `ollama list`

Vendor install pages:

- Docker: https://docs.docker.com/get-docker/
- Node.js: https://nodejs.org/en/download
- Ollama: https://ollama.com/download

### 3. Choose the embedding backend before `.env`

Explain that the embedding backend determines the `.env` values and must be
chosen before `docker compose up`.

- OpenAI: managed service; default model `text-embedding-3-small`; requires a
  valid `OPENAI_API_KEY`
- Ollama: local service; recommended model `nomic-embed-text`; if Ollama or
  the model is missing, ask whether to install or pull it now
- TEI: existing self-hosted embedding service; ask for `TEI_BASE_URL` and, if
  they do not want the repo default `Alibaba-NLP/gte-large-en-v1.5`,
  `TEI_MODEL`

Only use the TEI path when the user already has a reachable TEI service. This
skill does not provision TEI for them.

TEI reachability check:

```bash
curl -sS "${TEI_BASE_URL}/health"
```

Treat HTTP 200 from that endpoint as reachable. If the call errors or returns a
non-200 response, stop the TEI path and ask the user to fix the TEI service or
choose another backend.

Ollama URL rules:

- app in Compose on macOS or Windows, Ollama on host:
  `http://host.docker.internal:11434`
- app on the host, Ollama on the same machine: `http://127.0.0.1:11434`
- app in Compose on Linux, Ollama on host: ask the user for the reachable host
  IP or published port and do not guess it

Linux Ollama example: if the user says the host-reachable Ollama endpoint is
`192.168.1.10:11434`, use `OPENAI_API_URL=http://192.168.1.10:11434`.

Do not continue to `.env` until the user picks one path.

### 4. Configure `.env`

Use the exact environment block from the GitHub simple-stack doc for the chosen
backend when the raw GitHub fetch succeeds. If raw GitHub fetch fails, use the
local fallback file. If neither GitHub nor the local fallback is available, use
the inline fallback snippets below verbatim.

Confirm all of the following before writing:

- target directory
- whether `.env` already exists
- whether it is safe to create or overwrite the file

Treat overwrite as safe only when either `.env` does not already exist or the
user explicitly approved replacing the existing file after you told them what
will change.

Do not merge multiple `.env` variants in this skill. Create or replace one
plain `.env` file in the chosen working directory.

Treat the directory as writable only when the user approved that location and
you can create or replace `.env` there.

If writing `.env` would fail with a permission error, stop and ask the user for
another directory or for permission changes.

For the simple stack, make sure `.env` includes `QDRANT_API_KEY`,
`AUTH_ENABLED=false`, and only the variables required by the chosen embedding
backend.

If GitHub is unavailable and you already disclosed the fallback, these are the
minimum simple-stack snippets:

OpenAI:

```ini
OPENAI_API_KEY=sk-...
QDRANT_API_KEY=change-me
AUTH_ENABLED=false
```

Ollama with the app in Compose and Ollama on the host:

```ini
OPENAI_API_URL=http://host.docker.internal:11434
OPENAI_EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=ollama
QDRANT_API_KEY=change-me
AUTH_ENABLED=false
```

If the app runs on the host instead of in Compose, use
`OPENAI_API_URL=http://127.0.0.1:11434`.

TEI:

```ini
TEI_BASE_URL=http://your-tei:8080
QDRANT_API_KEY=change-me
AUTH_ENABLED=false
```

Add `TEI_MODEL` only when the user wants a model other than the repo default.

TEI with a non-default model:

```ini
TEI_BASE_URL=http://your-tei:8080
TEI_MODEL=your-custom-model
QDRANT_API_KEY=change-me
AUTH_ENABLED=false
```

### 5. Start and verify

Before starting, confirm that the required ports are free or intentionally
remapped.

Default simple-stack ports are:

- app: `PORT` -> `3000`
- Qdrant: `6333` and `6344`
- metrics: `METRICS_PORT` -> `9090`

Ask before running:

```bash
docker compose -p kairos-mcp up -d
```

Then verify the server:

```bash
curl -sS "http://localhost:${PORT:-3000}/health"
```

On native Windows outside Git Bash or WSL, substitute the actual port value and
use either:

```powershell
curl.exe http://localhost:3000/health
Invoke-WebRequest http://localhost:3000/health
```

If `PORT=3300` in `.env`, use `http://localhost:3300/health` in those Windows
commands.

If startup fails, inspect logs:

```bash
docker compose -p kairos-mcp logs app-prod
```

Before using that log command, verify the application service name in the
selected `compose.yaml`. In the repo's default file, the service name is
`app-prod`.

If the service name is different, read the `services:` keys in `compose.yaml`
and substitute the application service name. Example: if the service key is
`app`, run `docker compose -p kairos-mcp logs app`.

If you need to check the default ports before starting, inspect listeners on:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:6333 -sTCP:LISTEN
lsof -nP -iTCP:6344 -sTCP:LISTEN
lsof -nP -iTCP:9090 -sTCP:LISTEN
```

If `lsof` is unavailable, use `ss -ltn` or ask the user whether those ports are
already in use.

On Windows, use:

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :6333
netstat -ano | findstr :6344
netstat -ano | findstr :9090
```

If `3000` or `9090` is busy, ask whether to change `PORT` or `METRICS_PORT` in
`.env` before starting. If `6333` or `6344` is busy, ask whether to stop the
conflicting service before continuing or explicitly edit `compose.yaml`.

Concrete conflict examples:

- if `3000` is busy, add `PORT=3300` to `.env` and verify
  `http://localhost:3300/health`
- if `9090` is busy, add `METRICS_PORT=9191` to `.env`
- if `6333` or `6344` is busy, either stop the conflicting service or change
  the host side of the `compose.yaml` port mappings after explicit approval

If `PORT` changes, update the MCP URL to the same port. Example:
`http://localhost:3300/mcp`.

If `curl` fails after `up -d`, use this order:

1. Run `docker compose -p kairos-mcp ps`.
2. Inspect the application logs.
3. Re-check `.env` values for the chosen backend.
4. Confirm the embedding endpoint is reachable.

Failure mapping:

- if `docker compose ps` shows the app stopped, inspect logs first
- if the app is running but `curl` still fails, re-check host, port, and
  `/health`
- if logs show embedding errors, re-check the selected backend and its URL/key

### 6. Guide authentication when needed

For the default simple stack with `AUTH_ENABLED=false`, explain that CLI login
is not needed.

If the target server requires auth, guide the user through the CLI flow from
the GitHub CLI doc:

Treat auth as required when the user says the server has auth enabled or when
`kairos token --validate` returns `401` or `authentication required`.

If `kairos token --validate` fails because the server is unreachable, fix the
URL or connectivity first instead of starting the login flow.

If `kairos token --validate` fails with a server-side `5xx`, wait for the
server to recover or fix the server health before retrying login.

1. Make sure the CLI points at the correct server URL.

Use either of these patterns:

```bash
export KAIROS_API_URL=http://localhost:3000
kairos token --validate
```

```bash
kairos --url http://localhost:3000 search "health"
```
2. Prefer browser PKCE login when the user can open a browser:

```bash
kairos login
```

3. If the user already has a bearer token, offer:

```bash
kairos login --token <bearer-token>
```

Warn the user that putting tokens directly on the shell command line can leave
them in shell history or terminal transcripts.

4. If the browser must not auto-open, offer:

```bash
kairos login --no-browser
```

5. Validate the stored token when needed:

```bash
kairos token --validate
```

Keep the auth guidance focused on CLI usage. Identity-provider administration
remains outside this install skill.

### 7. MCP is optional

Configure `mcp.json` only if the user's IDE or host explicitly needs MCP over
HTTP. The CLI remains primary for verification and operations. Use the example
from:
https://github.com/debian777/kairos-mcp/blob/main/docs/install/README.md#cursor-and-mcp

Minimum MCP snippet:

```json
{
  "mcpServers": {
    "KAIROS": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Use this only when the user wants an IDE or another MCP host to connect to the
server. Do not create it just because the server exposes `/mcp`.

If `PORT` changed from the default, replace `3000` in the snippet with the
actual port from `.env`.

### 8. Update Docker and npm CLI (maintenance mode)

Run this section when the user asks to refresh Docker and the npm CLI for
KAIROS. Keep explicit approvals for each material update action.

1. Confirm update scope: Docker only, npm CLI only, or both.
2. Check current versions first:
   - `docker --version`
   - `docker compose version`
   - `npm --version`
   - `kairos --help` or `npx @debian777/kairos-mcp --help`
3. If updates are approved, use official vendor paths for Docker and npm/Node.
4. Refresh KAIROS CLI after toolchain updates:
   - global: `npm install -g @debian777/kairos-mcp@latest`
   - one-shot: `npx @debian777/kairos-mcp@latest --help`
5. Validate with the same version and health checks after update.
6. If Docker updates require daemon restart or host reboot, tell the user and
   stop until they confirm the host is back.

For detailed update commands, cross-platform checks, and fallback handling, use
`references/docker-npm-cli-updates.md`.

## Reference modules

Use these reference modules to keep this skill concise:

- `references/prerequisites.md`
- `references/docker-compose-simple.md`
- `references/docker-compose-full-stack.md`
- `references/docker-npm-cli-updates.md`
- `references/examples-and-validation.md`
