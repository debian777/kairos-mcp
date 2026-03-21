# Skills folder — references and structure (skill creators)

Generic info for **skill authors**: references and how the `skills/` folder is
organized. We do not ship one skill per KAIROS protocol (agent skill slots are
limited; protocols are unlimited). For **using** and installing skills, see
[README.md](README.md).

## References

- **[skills CLI (vercel-labs/skills)](https://github.com/vercel-labs/skills)** — `npx skills add`, list, remove, init; discovery paths (`skills/`, `skills/.system/`, etc.); supported agents.
- **[Agent Skills specification](https://agentskills.io/specification)** — Directory structure, `SKILL.md` format (frontmatter, body), optional `scripts/`, `references/`, `assets/`, progressive disclosure, validation with `skills-ref`.
- **[Claude Code: Extend Claude with skills](https://code.claude.com/docs/en/skills)** — Where skills live (personal, project, plugin), frontmatter (e.g. `disable-model-invocation`, `context: fork`), arguments (`$ARGUMENTS`), dynamic context, subagents.
- **[The Agent Skills Directory (skills.sh)](https://skills.sh/)** — Discover and install skills with `npx skills add <owner/repo>`; supports Cursor, Claude Code, and other agents.

## Folder structure

Skills are discovered under `skills/` (and, in this repo, under `skills/.system/`).
Each skill is a directory with a required `SKILL.md` and optional supporting
dirs per the [Agent Skills spec](https://agentskills.io/specification).

```
skills/
├── README.md              # How to use our skills
├── SKILLS.md              # This file — references and structure
├── kairos/                # Everyday: run protocols
├── kairos-bundle/         # Occasional: export/import bundles
└── .system/               # One-time / system skills (CLI discovery)
    └── kairos-install/
```

**Per-skill layout (spec-aligned):**

- **`SKILL.md`** — Required. YAML frontmatter (`name`, `description`) and markdown body. Optional: `argument-hint`, `allowed-tools`, `license`, `compatibility`, `metadata`.
- **`references/`** — Optional. Docs loaded when needed.
- **`scripts/`** — Optional. Runnable tooling the agent can invoke.
- **`assets/`** — Optional. Templates, images.

Keep `SKILL.md` under ~500 lines; put detail in referenced files.

## Validating skills (optional dev dependency)

The repo runs skill validation in CI and optionally on pre-commit when files
under `skills/` are staged. Validation uses **skills-ref** from the [Agent
Skills spec](https://agentskills.io/specification#validation) (Python).

- **CI:** Workflows install it and run `npm run lint:skills`.
- **Local:** If `skills-ref` is not installed, `npm run lint:skills` skips and exits 0; CI still validates. To validate locally, install the same pip package and ensure `skills-ref` is on your `PATH`.

## Relation to existing docs

- **KAIROS protocol execution:** [AGENTS.md](../AGENTS.md) — activate, forward, reward; tool descriptions in `src/embed-docs/tools/`.
- **Minting adapters:** [Building KAIROS workflows](../src/embed-docs/resources/building-kairos-workflows.md), [train](../src/embed-docs/tools/train.md).
