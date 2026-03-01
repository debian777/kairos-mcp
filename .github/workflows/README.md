# GitHub Actions workflows

## CI workflow (`integration.yml`)

Single workflow that runs **integration tests** on every PR and push to `main`, and on **tag push `v*.*.*`** also **publishes the npm package** and **builds/pushes the Docker image**.

- **Triggers:** `pull_request` (main), `push` (main), `push` (tags `v*.*.*`), `workflow_dispatch`.
- **Job `integration`:** Generate .env, restore Docker image cache, `npm ci && lint && knip && build && test && test:integration`, cache infra images. On tag, uploads a release artifact (dist, package.json, Dockerfile, etc.).
- **Job `publish-npm`** (tag only, after integration): Downloads release artifact, syncs version from tag, publishes to npm (uses OIDC when available).
- **Job `publish-docker`** (tag only, after integration): Downloads release artifact, builds multi-arch image from pre-built dist (no source build in Docker), pushes to Docker Hub.

### Secrets and variables (gh CLI)

**Secrets** (sensitive):

```bash
gh secret set OPENAI_API_KEY    # embedding / integration tests
gh secret set DOCKER_USERNAME  # for tag publish (Docker Hub)
gh secret set DOCKER_PASSWORD # for tag publish (Docker Hub)
# npm: use OIDC (id-token: write) and npm trusted publishing; no NPM_TOKEN needed if configured
```

**Optional:** `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_DB_PASSWORD`, `SESSION_SECRET` — CI can generate defaults if unset.

**List secrets (names only):**

```bash
gh secret list
```

In the workflow: `${{ secrets.OPENAI_API_KEY }}`, `${{ secrets.DOCKER_USERNAME }}`, etc.

`npm run lint` runs ESLint and **actionlint** on `.github/workflows/*.yml`. Install actionlint locally (e.g. `brew install actionlint` or the [install script](https://github.com/rhysd/actionlint#install)) so lint passes.

### Running manually

- **UI:** Actions → CI → Run workflow.
- **CLI:** `gh workflow run integration.yml`

### Docker build

The Dockerfile expects a **pre-built** `dist/` (no source build in the image). Run `npm run build` before `docker build`. In CI, the release artifact produced by the integration job contains `dist/` and is used as the build context for `publish-docker`.
