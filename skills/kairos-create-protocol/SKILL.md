---
name: kairos-create-protocol
description: Run the KAIROS "Create New KAIROS Protocol Chain" protocol. Use when the user invokes /k create new protocol, or asks to create a new protocol, mint a workflow, or build a protocol (when kairos_search found no match and user confirms).
compatibility: Requires KAIROS MCP server to be configured and connected.
metadata:
  version: "1.0.0"
  author: kairos-mcp
  protocol: references/KAIROS.md
  protocol_query: create new KAIROS protocol chain
allowed-tools: kairos_search kairos_begin kairos_next kairos_mint kairos_attest
---

# kairos-create-protocol

Run the **Create New KAIROS Protocol Chain** protocol via KAIROS. The protocol is bundled in [references/KAIROS.md](references/KAIROS.md). If it is not yet installed in your KAIROS space, mint it first, then run it.

## Versioning

- **Skill version:** In frontmatter above (`metadata.version`). Bumped when the skill instructions or protocol reference change.
- **Protocol version:** In [references/KAIROS.md](references/KAIROS.md) frontmatter (`version`). Bumped when the protocol steps or challenges change.

## Workflow

1. **Search** — Call `kairos_search` with query `create new KAIROS protocol chain` (or the user’s phrasing, e.g. "create new protocol", "mint a workflow"). Use the `space` parameter if the user or environment specifies one; otherwise omit (default space).
2. **If no strong match** (e.g. no choice with `score` ≥ 0.7) — Pick the **refine** choice from the response and run that protocol to improve the query, then search again.
3. **If no match** — Read [references/KAIROS.md](references/KAIROS.md). If it has YAML frontmatter (lines between `---`), pass only the markdown **after** the closing `---` to `kairos_mint` so the document starts with the H1. Use the same space as for search. Then search again.
4. **Run** — Follow the chosen match’s `next_action`: `kairos_begin` → `kairos_next` (loop) → `kairos_attest`. Echo nonces and proof hashes from the server. Do not respond to the user before `kairos_attest` when `must_obey: true`.

## Protocol summary

The protocol guides creating a new executable protocol chain: confirm intent, gather requirements (title, steps, challenges), draft markdown (H1, H2, Natural Language Triggers, Completion Rule, challenge blocks), user review, then call `kairos_mint`. Every step that can be verified has a challenge (user_input, comment, or mcp).
