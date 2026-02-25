# GitHub Actions workflows

## Integration workflow (manual)

`integration.yml` runs Docker infra (Redis, Qdrant, Postgres, Keycloak) with **AUTH enabled**, configures Keycloak realms and test user, then `npm run dev:deploy && npm run dev:test`. It is triggered **manually only** (`workflow_dispatch`) for testing. When stable, add `push`/`pull_request` to `on:` as needed.

### Secrets and variables (gh CLI)

You can use **GitHub Actions secrets** (sensitive) and **repository variables** (non-sensitive) in workflows. Set them with the GitHub CLI from the repo root:

**Secrets** (e.g. `OPENAI_API_KEY` for embedding tests):

```bash
# Set from stdin (prompted)
gh secret set OPENAI_API_KEY

# Set from env var
gh secret set OPENAI_API_KEY --body "$OPENAI_API_KEY"

# Set from file
gh secret set OPENAI_API_KEY < .env.local
```

**List secrets** (names only, values are hidden):

```bash
gh secret list
```

**Variables** (non-sensitive; use `vars.VAR_NAME` in the workflow):

```bash
gh variable set MY_VAR --body "value"
gh variable list
```

In the workflow, use `${{ secrets.OPENAI_API_KEY }}` and `${{ vars.MY_VAR }}`. The integration workflow uses:

- **Optional secrets:** `OPENAI_API_KEY` (embedding tests), `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_DB_PASSWORD`, `SESSION_SECRET`. If not set, CI uses fixed defaults for Keycloak and generates `SESSION_SECRET` so the job runs without any secrets.

### Running the integration workflow manually

- **UI:** Actions → Integration (manual) → Run workflow.
- **CLI:** `gh workflow run integration.yml` (from default branch).
