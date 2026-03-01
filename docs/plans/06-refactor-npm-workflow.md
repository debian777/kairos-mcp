# Plan: Refactor to npm-first dev workflow (Redis/memory assumed)

**Assumption:** Redis/memory switch is implemented (`CACHE_BACKEND=redis|memory`; dev can run with memory + Qdrant only).

**Goals:** Drop `run-env.sh`, use standard npm workflow; one env for this repo (dev); prod out of scope. Same flow locally and in GitHub Actions with minimal divergence.

---

## Phases overview

| Phase | Purpose | Deps | Auth | Runs |
|-------|---------|------|------|------|
| **1. Dev** | Fast feedback, no infra | Qdrant (e.g. Testcontainers) + memory backend | No | `npm run test` |
| **2. Integration** | Full stack, auth | Redis, Qdrant, Postgres, Keycloak (compose) | Yes | `npm run test:integration` |
| **3. Build** | Artifacts | None | — | `npm run build`, `npm run docker:build` |
| **4. Publish** | On tag | — | — | npm publish + docker push |

---

## Phase 1 – Dev (no run-env)

### 1.1 npm scripts (replace run-env.sh usage)

**Remove:** All `dev:*` and `qa:*` and `prod:*` that call `./scripts/run-env.sh`.

**Add / keep:**

- **`lint`** – already exists (eslint).
- **`knip`** – already exists.
- **`build`** – already exists (prebuild + tsc); keep as single source of truth.
- **`test`** – **new meaning:** run dev-phase tests (no auth, memory backend, Qdrant only).
  - Set env: `AUTH_ENABLED=false`, `CACHE_BACKEND=memory`, optionally `PORT` from free port if app is started by Jest.
  - Run Jest. No `dev:deploy`; either:
    - **Option A:** App started externally (user runs `npm run dev:start` in another terminal), tests assume `MCP_URL`/`PORT` from env; or
    - **Option B:** Jest `globalSetup` allocates a free port, starts the app, writes `MCP_URL`/`PORT` for tests, and `globalTeardown` stops it.
  - Recommendation: **Option A** for simplicity (same as today: “start app then test”); document as `npm run dev:start` then `npm run test`. CI can do both in one job.
- **`dev:start`** – start app for dev (no run-env):
  - `dotenv -e .env.dev -- node --loader ts-node/esm src/index.ts` (or `node dist/index.js` if built), with `PORT` from env (default 3300).
  - Log to file or stdout per existing LOG_TARGET.
- **`dev:stop`** – stop app: kill process using `PORT` (e.g. via small script using `lsof -ti :$PORT` and `kill`), or PID file if introduced.
- **`dev:restart`** – `dev:stop` then `dev:start`.
- **`infra:up`** – keep: `docker compose -p kairos-mcp --env-file .env.dev --profile infra up -d ...` + Keycloak config.
- **`test:integration`** – run tests with full infra and auth:
  - Expect: infra already up (`npm run infra:up` or CI step), app already running or started in same script.
  - Env: `.env.dev` with `AUTH_ENABLED=true`, `CACHE_BACKEND=redis`, `REDIS_URL`, etc.
  - Run Jest (same suite, different env). No run-env.

**Drop:** `dev:build` (use `build`), `dev:deploy` (become `build` + `dev:restart` or just “build; then start if you want”), `dev:logs` (could be “cat .kairos-dev.log” or similar), `dev:status` (optional small script), `dev:qdrant-curl` / `dev:redis-cli` (optional: keep as tiny scripts that only need env). Remove all **qa:*** and **prod:*** scripts from this repo (prod out of scope; qa folded into “integration” phase).

**ensure-coding-rules:** Today it lives in run-env.sh. Extract to a small standalone script (Node or bash) that checks: not on main, clean working tree, test report for current commit; call it from `npm run ensure-coding-rules`.

### 1.2 Test setup for dev phase

- **`tests/setup.ts`:** If `CACHE_BACKEND` is not set and we’re not in integration mode, set `CACHE_BACKEND=memory` so tests don’t need Redis. Keep fallbacks for `QDRANT_URL` (and `REDIS_URL` only when `CACHE_BACKEND=redis`).
- **`tests/env-loader.ts`:** Keep loading `.env.${ENV}` / `.env`; ensure it runs before config is imported.
- **Jest:** Single config; mode is controlled by env (AUTH_ENABLED, CACHE_BACKEND, etc.). No need for two Jest configs if env cleanly separates dev vs integration.

### 1.3 Optional: Qdrant via Testcontainers in dev

- For zero manual infra in dev, add a Jest globalSetup that starts Qdrant via Testcontainers when e.g. `QDRANT_URL` is not set, sets `QDRANT_URL` to the container URL, and tears it down in globalTeardown. Optional; can be a follow-up so dev can still rely on “Qdrant on localhost:6333” or user-started container.

### 1.4 Port handling (dev vs prod on same machine)

- **CI:** Single stack per job; fixed ports (6333, 6379, 3300, etc.) are fine.
- **Local with prod compose elsewhere:** Use a distinct compose project name for dev (e.g. `-p kairos-mcp-dev`) and **parameterize host ports** in compose so dev doesn’t clash with prod:
  - In `compose.yaml`: e.g. `"${REDIS_HOST_PORT:-6379}:6379"`, `"${QDRANT_HOST_PORT:-6333}:6333"`, etc.
  - In `.env.dev` (or template): set `REDIS_HOST_PORT=6380`, `QDRANT_HOST_PORT=6334`, etc., when running dev alongside prod. App and tests then use `REDIS_URL=redis://127.0.0.1:6380`, `QDRANT_URL=http://127.0.0.1:6334`.
- Defaults keep CI and simple local setups unchanged.

---

## Phase 2 – Integration

- **Prerequisite:** Full infra up: `docker compose -p kairos-mcp --env-file .env.dev --profile infra up -d`, then Keycloak realms configured.
- **App:** Start app with `.env.dev` (AUTH_ENABLED=true, Redis, Qdrant, Keycloak). One-liner: `npm run dev:start` (or a small script that sets env and runs node).
- **Tests:** `npm run test:integration` = run Jest with same env (MCP_URL, PORT, etc.). No run-env.sh.
- **CI:** Same as today: generate .env/.env.dev, start infra, wait for Redis/Qdrant/Postgres/Keycloak, configure Keycloak, then:
  - `npm ci && npm run knip && npm run build`
  - Start app (e.g. `npm run dev:start` in background or use a small start script that writes PID)
  - Wait for health (curl loop on PORT/health)
  - Run `npm run test:integration`
  - Optionally upload app log artifact on failure (e.g. `.kairos-dev.log`).

---

## Phase 3 – Build

- **`npm run build`** – already: prebuild + lint + tsc. Keep.
- **Package:** Optional `npm pack` script if you want a tarball; not required for publish (npm publish uses files from package.json).
- **Docker:** Keep `docker:build` (and Dockerfile installing from repo). No change unless you later switch to “install published package” in image.

---

## Phase 4 – Publish

- **On tag `v*.*.*`:** Keep existing workflows:
  - **publish-npm.yml:** checkout, setup Node, sync version from tag, `npm ci`, lint, knip, build, `npm publish`.
  - **publish-docker.yml:** checkout, version from tag, Docker build and push.
- No run-env or dev/qa/prod scripts needed here.

---

## File and script changes (checklist)

1. **package.json**
   - Remove: `dev:build`, `dev:deploy`, `dev:logs`, `dev:qdrant-curl`, `dev:redis-cli`, `dev:restart`, `dev:start`, `dev:status`, `dev:stop`, `dev:test`, all `qa:*`, all `prod:*` that call run-env.
   - Add/keep: `test` (dev phase, memory + no auth), `test:integration` (full infra + auth), `dev:start`, `dev:stop`, `dev:restart` implemented without run-env (see 1.1).
   - Keep: `build`, `lint`, `knip`, `infra:up`, `ensure-coding-rules` (after extracting from run-env), `docker:build`, `docker:push`, `docker:publish`.
   - Optional: `handoff` = test + test:integration + ensure-coding-rules + knip (no qa/prod).

2. **scripts/run-env.sh**
   - Delete or reduce to a minimal stub that only runs `ensure-coding-rules` if you keep the script name for that. Prefer moving ensure-coding-rules to a dedicated script and deleting run-env.sh.

3. **scripts/** (new or updated)
   - **dev-start.sh** (or Node script): source .env.dev, start node (ts-node or dist), write PID to `.kairos-dev.pid`, log to `.kairos-dev.log` or stdout.
   - **dev-stop.sh**: read PID from `.kairos-dev.pid` or use `lsof -ti :$PORT`, kill process.
   - **ensure-coding-rules.sh** (or .mjs): not on main, clean working tree, test report for current commit; exit 1 on failure.

4. **tests/setup.ts**
   - For dev phase: if `TEST_MODE !== 'integration'` (or similar), set `CACHE_BACKEND=memory` when unset so no Redis required. Keep QDRANT_URL default for local.

5. **.github/workflows/integration.yml**
   - Replace `npm run dev:deploy && npm run dev:test` with: build, then start app (e.g. `npm run dev:start` with env), wait for health, then `npm run test:integration`.
   - No run-env.sh. Same steps: generate env, start infra, wait for services, configure Keycloak, install, knip, build, start app, run tests.

6. **compose.yaml** (optional for same-machine dev)
   - Parameterize host ports for infra (e.g. `${REDIS_HOST_PORT:-6379}:6379`) and document in README for “dev next to prod”.

7. **README / docs**
   - Document: “Dev: `npm run dev:start` (or use memory + Qdrant only), then `npm run test`.” “Integration: `npm run infra:up`, then start app, then `npm run test:integration`.” “Prod is not managed by this repo.”

---

## Order of implementation

1. Extract **ensure-coding-rules** to a standalone script; update package.json to call it.
2. Add **dev:start** / **dev:stop** / **dev:restart** scripts (no run-env); point package.json to them.
3. Change **test** to dev-phase (AUTH_ENABLED=false, CACHE_BACKEND=memory in setup when appropriate); add **test:integration** that expects full env.
4. Update **integration.yml** to use new scripts and `test:integration`.
5. Remove all **qa:*** and **prod:*** scripts and run-env.sh (or stub).
6. (Optional) Parameterize compose ports and document.
7. Update README and any cursor rules that reference run-env or qa/prod.

---

## Summary

- **Dev:** npm lint → build → test (memory + Qdrant; no auth). App via `npm run dev:start` (or Jest-started if you add Option B).
- **Integration:** Full infra (compose), then `npm run test:integration` (auth + Redis).
- **Build / Publish:** Unchanged; no run-env.
- **Same locally and in CI:** Same npm commands; only env (and infra) differ. No run-env.sh.
