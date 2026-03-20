# KAIROS skills — how to use them

Skills from this repo let you run KAIROS protocols (search → begin → next →
attest) in Cursor or Claude Code. Install with:
`npx skills add debian777/kairos-mcp`. For **authoring** skills (structure,
protocol requirements, validation), see [SKILLS.md](SKILLS.md).

**References:** [skills CLI (vercel-labs/skills)](https://github.com/vercel-labs/skills) · [Agent Skills Directory (skills.sh)](https://skills.sh/)

## Installing skills from this repo

Install with: `npx skills add debian777/kairos-mcp`. The repo ships
**multiple skills**. Adding the repo without `--skill` typically installs
**all** of them. Use `--skill` to install only the ones you need.

### Usage tiers

| Usage         | Skill           | When to install / use |
|---------------|-----------------|------------------------|
| **Everyday**  | kairos          | Default: run protocols; /k, /apply, /search. Install this first. |
| **Occasional** | kairos-bundle   | Export/import protocol bundles; use when backing up or moving protocols. |
| **One-time**  | kairos-install  | First-time environment setup (Ollama, kairos-mini); run once per machine. |

**Recommended:** Install `kairos` for daily use. Add `kairos-bundle` when
you need export/import; run `kairos-install` once for setup.

**Install all skills:**

```bash
npx skills add debian777/kairos-mcp
```

**Install only specific skills** (repeat `--skill` for each):

```bash
npx skills add debian777/kairos-mcp --skill kairos --skill kairos-bundle
```

**List available skills:** `npx skills add debian777/kairos-mcp --list`

| Skill | Usage | Purpose |
|-------|-------|---------|
| kairos | Everyday | Run protocols; /k, /apply, /search. |
| kairos-bundle | Occasional | Export/import protocol bundles; scripts: kairos-bundle.py. |
| kairos-install | One-time | First-time install: Ollama + kairos-mini; confirm each step with user. |

**Global install for Cursor / Claude Code** (non-interactive): add `-y -g`
and optionally `-a cursor` or `-a claude-code`. Example:

```bash
npx skills add debian777/kairos-mcp --skill kairos -y -g -a cursor
```

**Remove:** `npx skills remove <skill-name> -g` (e.g. `kairos`, `kairos-bundle`).

See the [main README](../README.md#agent-skills) for a short table and
agent-specific commands.

**Layout:** Everyday and occasional skills live in `skills/<skill-name>/`. The
one-time setup skill lives in `skills/.system/kairos-install/` (per [skills
CLI](https://github.com/vercel-labs/skills) discovery). CI and `npm run lint:skills` validate both locations.
