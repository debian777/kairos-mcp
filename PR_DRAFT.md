# PR: Shared auth model (MCP / CLI / API) and CLI auth

## Summary

Implements a shared auth model across MCP, CLI, and API: MCP and CLI read/write auth (config, login, logout); API remains read-only. Adds CLI auth via config file, `login` / `logout` commands, 401 handling with optional browser open, and `--no-browser` for automation. Includes E2E tests for browser login and fixes for Jest open handles in CLI auth E2E.

## Branch

- **Branch:** `cursor/shared-auth-model-88dc`
- **Base:** `main`

## Changes

### Auth model

- **MCP (rw):** Uses bearer token from env/config; can trigger login flow.
- **CLI (rw):** Full auth lifecycle: config file, `kairos login` (token or browser PKCE), `kairos logout`, 401 handling with optional `--no-browser` / `--no-open`.
- **API (ro):** Validates tokens; no login/logout.

### CLI auth

- **Config:** Multi-env config file (`config-file.ts`), token stored per default URL.
- **Commands:** `login` (optional `--token`, or browser with `--no-browser` to only print URL), `logout`.
- **401 handling:** ApiClient validates token; on 401 with `login_url`, can auto-open browser unless `--no-browser` / `KAIROS_CLI_NO_AUTO_LOGIN=1`.
- **Default:** Open browser by default for login; use `--no-browser` to disable (e.g. tests, scripts).

### Tests and CI

- **CLI auth E2E:** `cli-auth-browser-login.e2e.test.ts` — `login --no-browser`, capture URL from stdout, Playwright drives Keycloak, then logout and search-without-token.
- **CLI command tests:** Use `KAIROS_CLI_NO_AUTO_LOGIN=1` and shared helpers so no browser is opened.
- **Jest open-handle fixes (in branch / to be committed):**
  - Clear 30s timeout in `spawnLoginAndCaptureAuthUrl` when the login process closes.
  - Clear 12s timeout in “search without token” test when `runCli` wins the race (`.finally(() => clearTimeout(timeoutId))`).
  - Rely only on `--no-browser` for “no browser”; no redundant `BROWSER` env override.
- **CI:** Playwright browsers installed for E2E; global setup and auth-headers exports for tests.

### Docs and scripts

- **Docs:** `docs/CLI.md`, `docs/auth-overview.md`; install and env examples updated.
- **Scripts:** `configure-keycloak-realms.py`, `dev-cli-ready.sh`, `disable-local-login.py`, Keycloak import/README updates.

### Other

- **Lint:** ESLint rule to disallow `KAIROS_BEARER_TOKEN` in `src/cli` (use config/env).
- **UI:** App auth/UI adjustments for shared model.

## How to test

1. Build and deploy dev:
   ```bash
   npm run dev:build && npm run dev:deploy
   ```
2. Run CLI auth E2E:
   ```bash
   npm run dev:test -- tests/integration/cli-auth-browser-login.e2e.test.ts
   ```
3. Run full test suite:
   ```bash
   npm run dev:test
   ```

**Note:** Commit any unstaged changes in `tests/integration/cli-auth-browser-login.e2e.test.ts` (open-handle and BROWSER cleanup) so the PR includes them.

## Checklist

- [ ] All tests pass after `npm run dev:build && npm run dev:test`
- [ ] CLI auth E2E runs without Jest open-handle warnings
- [ ] No browser opens when running tests (CLI uses `--no-browser` / `KAIROS_CLI_NO_AUTO_LOGIN=1`)
- [ ] Docs and env examples reflect new auth and CLI usage
