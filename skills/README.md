# Skills that ship KAIROS protocols

This document describes how a Cursor (or similar) skill can bundle a KAIROS
protocol and run it by searching first, then minting (installing) the
protocol if it is not yet present. It aligns with the [Cursor create-skill
SKILL.md
spec](https://github.com/cursor/skills/blob/main/create-skill/SKILL.md) and
KAIROS protocol execution (search → begin → next → attest).

## Installing skills from this repo

The repo ships **multiple skills**. Adding the repo without `--skill` typically installs **all** of them. Use `--skill` to install only the ones you need.

**Install all skills:**

```bash
npx skills add debian777/kairos-mcp
```

**Install only specific skills** (repeat `--skill` for each):

```bash
npx skills add debian777/kairos-mcp --skill kairos --skill kairos-code
```

**List available skills:** `npx skills add debian777/kairos-mcp --list`

| Skill | Purpose |
|-------|---------|
| kairos | Run protocols; /k, /apply, /search. |
| kairos-install | First-time install: Ollama + kairos-mini; confirm each step with user. |
| kairos-code | ELITE AI CODING STANDARDS; /code. |
| kairos-ai-docs | Zero-drift AI instructions; /ai-docs. |
| kairos-create-protocol | Create and mint new protocol chains. |
| kairos-create-skill | Create skills that ship protocols. |
| kairos-refine-search | Refine a weak/empty search (better query). |
| kairos-chat-gaps | Identify KAIROS gaps and blind spots from chat history; extract Cursor transcripts or supply JSON in documented format; scripts: extract, ingest, analyze. |
| kairos-development | Agent instructions for kairos-dev (workflow-test, ai-mcp-integration). |

**Global install for Cursor / Claude Code** (non-interactive): add `-y -g` and optionally `-a cursor` or `-a claude-code`. Example:

```bash
npx skills add debian777/kairos-mcp --skill kairos-code -y -g -a cursor
```

**Remove:** `npx skills remove <skill-name> -g` (e.g. `kairos`, `kairos-code`).

See the [main README](../README.md#agent-skills) for a short table and agent-specific commands.

## Purpose

- **Single unit of delivery:** A skill can ship both instructions and the
  protocol it needs. The agent does not need a separate "install protocol"
  step in another repo or doc.
- **Discover and run or install:** The skill starts by searching for the
  protocol. If a match exists, the agent runs it. If not, the agent mints
  the bundled protocol (install), then runs it.
- **Requirements in one place:** The skill declares what protocol it
  requires and where the protocol markdown lives. Requirements stay
  next to the skill instructions.
- **Skills give new functionality:** We are not limited to generic shell
  commands. A skill can ship **`scripts/`** (and `references/`, `assets/`)
  so the agent runs versioned, skill-specific tooling instead of ad-hoc
  commands. Scripts live next to the skill and travel with it.

## Skill structure (SKILL.md–aligned)

Skills follow the usual layout: a directory with `SKILL.md` and optional
supporting files. The create-skill spec requires:

- **`SKILL.md`** — YAML frontmatter (`name`, `description`) and markdown body.
- **Optional:** `reference.md`, `examples.md`, `scripts/`, etc.

We add an optional place for **protocol requirements** and **bundled
protocols**. Per the [Agent Skills
spec](https://agentskills.io/specification), supporting content lives in
**`references/`** (docs loaded when needed), **`scripts/`** (runnable
tooling the agent can invoke), and **`assets/`**. The bundled protocol
markdown fits under `references/`:

```
skill-name/
├── SKILL.md                    # Required — main instructions
├── references/                 # Optional — docs loaded when needed (spec-aligned)
│   └── KAIROS.md               # Mintable protocol (H1, H2, challenge blocks)
├── scripts/                    # Optional — skill-specific scripts (run these, not only generic shell)
└── ...
```

You can also use a `protocols/` subfolder or a single file at the skill root
(e.g. `protocol.md`); for spec alignment and progressive disclosure, prefer
**`references/`** so the protocol is loaded only when the agent needs to mint
or read it.

## Declaring protocol requirements

The skill must tell the agent (1) which protocol to run and (2) where to
find the markdown if mint is needed.

**Option A — Frontmatter (recommended when tooling reads it):**

```yaml
---
name: standardize-project
description: Run the Standardize Project protocol. Use when the user asks to
  standardize a project or run the standardize-project workflow.
metadata:
  protocol: references/KAIROS.md
  protocol_query: standardize project
---
```

- **`protocol`** — Path to the bundled protocol markdown (relative to the
  skill directory). If missing, the agent cannot mint; it can only search and
  run.
- **`protocol_query`** — Query string for `kairos_search`. Used to detect
  whether the protocol is already present and to choose the chain to run.
  Should match the protocol's **Natural Language Triggers** (e.g. first H2
  in the doc).

**Option B — In the SKILL.md body:**

If frontmatter is not extended, put the same information in the first
section:

```markdown
# Standardize Project

**Protocol:** This skill runs the KAIROS protocol "Standardize Project".
- **Search query:** `standardize project`
- **Bundled protocol (mint if missing):** [references/KAIROS.md](references/KAIROS.md)
```

The agent must read this section and use it for search and optional mint.

## Agent workflow: search → mint if missing → execute

When the user invokes the skill (or the agent otherwise applies it), the
agent follows this flow.

1. **Search**  
   Call `kairos_search` with the skill's protocol query (e.g. `standardize
   project`). Use the space the user or environment specifies; default space
   if not specified.

2. **Decide: run or install**  
   - If the search returns a **match** (`choices` with a `role: "match"` or
     equivalent): go to step 3 (run).  
   - If there is **no match** (or only low-confidence choices): the protocol
     is not installed. Go to step 2b (install).

3. **Run the protocol**  
   Follow the chosen match's `next_action` (e.g. `kairos_begin` with the
   given URI). Then: `kairos_begin` → `kairos_next` (loop) until
   `next_action` directs to `kairos_attest` → `kairos_attest`. Do not
   respond to the user before attestation when `must_obey: true`. (See
   [AGENTS.md](../AGENTS.md) and protocol execution model.)

4. **Install when missing (step 2b)**  
   - Read the bundled protocol file from the skill (`protocol` path or the
     path stated in the skill body).  
   - Call `kairos_mint` with that markdown (and the required parameters:
     `markdown_doc`, `llm_model_id`, optional `force_update`). Use the same
     space as for search.  
   - After a successful mint, search again with the same query, then run as
     in step 3.

If the skill does **not** bundle a protocol (no `protocol` path and no
bundled file referenced in the body), the agent must not invent a protocol.
It can only search and run; if nothing matches, it reports that the
protocol is not installed and may point the user to where to get it.

## Requirements and constraints

- **Protocol format:** Bundled markdown must be mintable: H1 for the chain,
  H2 steps, `## Natural Language Triggers` (first H2), `## Completion Rule`
  (last H2), and a trailing ` ```json ` block with `{"challenge": {...}}` per
  verifiable step. See [Building KAIROS
  workflows](../src/embed-docs/resources/building-kairos-workflows.md)
  and [kairos_mint](../src/embed-docs/tools/kairos_mint.md).
- **Single chain per file:** One protocol file = one H1 = one chain. For
  multiple protocols, use multiple files under `protocols/` and declare
  which one the skill uses (e.g. one `protocol` + `protocol_query` per
  intent).
- **Spaces:** The skill or the agent must resolve the target space (name or
  default). Use space names in tool parameters; the backend resolves to
  IDs.
- **Idempotent mint:** If the protocol is already present (same logical
  chain), mint with `force_update: false` to avoid overwriting, or
  `force_update: true` only when the user or skill explicitly requests an
  update.

## Protocol versioning

Protocols can carry a **version** (e.g. semver `1.0.0`) so agents can detect
when the bundled protocol is newer than the one stored in KAIROS.

- **Where the version comes from:** Put `version: "1.0.0"` in YAML frontmatter
  at the top of the protocol markdown (between the first `---` and second
  `---`). When minting, the server parses this and stores it on the chain.
  You can also pass an optional `protocol_version` argument to `kairos_mint`
  to override or supply the version when the document has no frontmatter.
- **Exposure to agents:** `kairos_search` returns a `protocol_version` field
  on each match choice (null for refine/create). `kairos_dump` includes
  `protocol_version` when the memory is part of a chain that has one.
- **Re-mint when bundled is newer:** After search, if there is a match, the
  agent should compare the choice's `protocol_version` with the version in
  the skill's bundled protocol file (e.g. `references/KAIROS.md` frontmatter).
  If the bundled version is newer (e.g. by semver) or the stored protocol has
  no version, call `kairos_mint` with the full protocol document and
  `force_update: true`, then search again and run the chosen match. Skills
  that ship protocols document this step in their workflow.

Skill versions (SKILL.md `metadata.version` and references/KAIROS.md
frontmatter `version`) are kept in sync with the **last stable release**
(latest git tag `vX.Y.Z`, or `1.0.0` if none). Built-in protocol sources in
`src/embed-docs/mem` use the **package.json** version. Run
`npm run version:sync-skills` as part of the release flow (e.g. after
tagging a stable release); CI runs `npm run version:check-skills` to ensure
alignment.

## Example: skill that runs or installs one protocol

**Directory:**

```
standardize-project/
├── SKILL.md
└── references/
    └── KAIROS.md
```

**SKILL.md (excerpt):**

```markdown
---
name: standardize-project
description: Run the KAIROS "Standardize Project" protocol in two parts
  (Analyze & Plan, then Execute & Ship). Use when the user asks to
  standardize a project or run the standardize-project workflow.
metadata:
  protocol: references/KAIROS.md
  protocol_query: standardize project
---

# Standardize Project

1. **Search** — Call `kairos_search` with query "standardize project".
2. **If no match** — Read [references/KAIROS.md](references/KAIROS.md)
   and call `kairos_mint` with that markdown; then search again.
3. **Run** — Follow the match's `next_action`: `kairos_begin` → `kairos_next`
   (loop) → `kairos_attest`. Echo nonces and proof hashes from the server.
```

The agent has everything it needs: when to apply the skill (description),
what to search for (`protocol_query`), where to get the doc to mint
(`protocol`), and how to execute (search → mint if missing → run).

## Validating skills (optional dev dependency)

The repo runs skill validation in CI and optionally on pre-commit when files
under `skills/` are staged. Validation uses **skills-ref** (Python), which is
not an npm package — it is an optional dev dependency in the project sense.

- **CI:** Workflows install it with `pip install "skills-ref @ git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref"` and run `npm run lint:skills`.
- **Local:** If `skills-ref` is not installed, `npm run lint:skills` skips validation and exits 0 so commits succeed; CI will still validate. To validate locally, install the same pip package and ensure `skills-ref` is on your `PATH`.

## Relation to existing docs

- **Cursor create-skill:** [Skill file
  structure](https://github.com/cursor/skills/blob/main/create-skill/SKILL.md)
  — directory layout, frontmatter, description, progressive disclosure.
  This concept adds an optional `protocol` / `protocol_query` and
  `protocols/` (or `protocol.md`) without changing the rest.
- **KAIROS protocol execution:** [AGENTS.md](../AGENTS.md) — search,
  begin, next, attest; must_obey; echo server-generated nonces and hashes.
- **Minting:** [workflow-kairos-mint](../docs/architecture/workflow-kairos-mint.md),
  [Building KAIROS
  workflows](../src/embed-docs/resources/building-kairos-workflows.md),
  [kairos_mint](../src/embed-docs/tools/kairos_mint.md).

## Summary

| Idea | Detail |
|------|--------|
| **Ship protocols in skills** | Optional `protocols/` (or `protocol.md`) in the skill directory. |
| **Ship scripts in skills** | Optional `scripts/` — skill-specific runnable tooling; agents use these instead of only generic shell. |
| **Requirements** | Skill declares protocol query and path to bundled markdown (frontmatter or body). |
| **Flow** | Search → if missing, mint from bundled file → then run (begin → next* → attest). |
| **SKILL.md compatibility** | Standard frontmatter and body; optional `protocol` and `protocol_query`; no change to description or discovery. |

This gives a single, shippable unit: the skill and its protocol together, with
a clear "search first, install if missing, then execute" behavior.
