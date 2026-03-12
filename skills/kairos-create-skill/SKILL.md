---
name: kairos-create-skill
description: Run the KAIROS protocol for creating a KAIROS skill (Agent Skill with optional references/KAIROS.md). Use when the user wants to create a KAIROS skill, create a skill with a KAIROS protocol, write SKILL.md, or asks about skill structure and Agent Skills format (agentskills.io).
compatibility: Requires KAIROS MCP server to be configured and connected.
metadata:
  version: "1.0.0"
  author: kairos-mcp
  protocol: references/KAIROS.md
  protocol_query: create KAIROS skill with KAIROS.md protocol
allowed-tools: kairos_search kairos_begin kairos_next kairos_mint kairos_attest
---

# kairos-create-skill

Run the **Create KAIROS skill (with KAIROS.md protocol)** protocol via KAIROS. The protocol is bundled in [references/KAIROS.md](references/KAIROS.md). If it is not yet installed in your KAIROS space, mint it first, then run it.

## Versioning

- **Skill version:** In frontmatter above (`metadata.version`). Bumped when the skill instructions or protocol reference change.
- **Protocol version:** In [references/KAIROS.md](references/KAIROS.md) frontmatter (`version`). Bumped when the protocol steps or challenges change.

## Workflow

1. **Search** — Call `kairos_search` with query `create KAIROS skill with KAIROS.md protocol` (or the user’s phrasing, e.g. "create KAIROS skill", "create skill with protocol"). Use the `space` parameter if the user or environment specifies one; otherwise omit (default space).
2. **If no strong match** (e.g. no choice with `score` ≥ 0.7) — Pick the **refine** choice from the response and run that protocol to improve the query, then search again.
3. **If no match** — Read [references/KAIROS.md](references/KAIROS.md). If it has YAML frontmatter (lines between `---`), pass only the markdown **after** the closing `---` to `kairos_mint` so the document starts with the H1. Use the same space as for search. Then search again.
4. **Run** — Follow the chosen match’s `next_action`: `kairos_begin` → `kairos_next` (loop) → `kairos_attest`. Echo nonces and proof hashes from the server. Do not respond to the user before `kairos_attest` when `must_obey: true`.

## Protocol summary

The protocol has six steps: (1) **Verify skill directory structure** — directory name matches `name`, SKILL.md present, optional references/ scripts/ assets/. (2) **Gather requirements and draft SKILL.md** — purpose, triggers, location; frontmatter and body. (3) **Create protocol via KAIROS** — search for "create new KAIROS protocol chain", run that protocol to produce a protocol doc, save to references/KAIROS.md (or state no protocol). (4) **Mint protocol** — if references/KAIROS.md exists, strip frontmatter and call kairos_mint; report chain head URI or skip. (5) **Verify by execution** — run the minted protocol (or skill) in a subagent or new chat with no prior context; report pass/fail. (6) **Lint skill** — run skills-ref validate; report pass/fail or skipped. Use for personal (~/.cursor/skills/) or project (.cursor/skills/) skills.
