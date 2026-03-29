# Bundled install documentation (`kairos-install` skill)

These Markdown files are **copies** of pages under **`docs/install/`** (plus
[`docs/CLI.md`](../../../docs/CLI.md)). They ship here so agents can read install
guidance without a full repo checkout. **Canonical source:**

https://github.com/debian777/kairos-mcp/tree/main/docs/install

## Files in this folder

| File | Upstream |
|------|----------|
| [docker-compose-simple.md](docker-compose-simple.md) | `docs/install/docker-compose-simple.md` |
| [docker-compose-full-stack.md](docker-compose-full-stack.md) | `docs/install/docker-compose-full-stack.md` |
| [cursor-mcp.md](cursor-mcp.md) | `docs/install/cursor-mcp.md` |
| [env-and-secrets.md](env-and-secrets.md) | `docs/install/env-and-secrets.md` |
| [CLI.md](CLI.md) | `docs/CLI.md` |
| [REFERENCE-LINKS.md](REFERENCE-LINKS.md) | Skill URL index |
| [install/google-auth-dev.md](install/google-auth-dev.md) | `docs/install/google-auth-dev.md` |

The sync script rewrites some links to **GitHub `blob/main` URLs** where the
bundle has no local mirror (for example `AGENTS.md`, architecture pages).

**Install hub** (diagram and table of all guides): upstream
[`docs/install/README.md`](../../../docs/install/README.md) — not duplicated here;
open the repo or use [REFERENCE-LINKS.md](REFERENCE-LINKS.md).

**`.env` templates** are inlined in the Docker install guides (`docker-compose-*.md`);
there are no separate `env.example.*.txt` files.

## Refresh copies (maintainers)

From the repository root:

```bash
npm run skills:sync-install-refs
```

That runs `scripts/sync-kairos-install-references.py`. It does **not** overwrite
this file or `REFERENCE-LINKS.md`.
