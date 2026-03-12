---
version: 1.0.0
title: Create KAIROS skill (with KAIROS.md protocol)
---

# Create KAIROS skill (with KAIROS.md protocol)

Guide creating an Agent Skill for Cursor (or compatible host) that can bundle a KAIROS protocol in `references/KAIROS.md`, per the [Agent Skills specification](https://agentskills.io/specification) and [skills README](../../README.md). Covers directory structure, SKILL.md draft, protocol creation (via “create new KAIROS protocol” flow), minting, execution verification, and linting.

## Natural Language Triggers

**Run this protocol when the user says ANY of:**

- "create a KAIROS skill" / "create KAIROS skill with protocol"
- "create a skill" / "create Cursor skill" / "write SKILL.md" / "create Agent Skill"
- "create skill with KAIROS.md" / "skill that ships a KAIROS protocol"

**Trigger pattern:** **create** / **write** / **add** + (skill / KAIROS skill / SKILL.md / Agent Skill) [+ (protocol / KAIROS.md)].

**Must Never:**
- Create skills in `~/.cursor/skills-cursor/`.
- Use uppercase or spaces in skill `name` (use lowercase, hyphens, max 64 chars).
- Omit the `Natural Language Triggers` section when drafting a protocol inside this flow.

**Must Always:**
- Use `name` (lowercase, hyphens, max 64 chars, match directory) and `description` (what + when, third person, max 1024 chars) in SKILL.md.
- Keep SKILL.md under ~500 lines; use `references/` for protocol and detail.
- Add a challenge (```json block) to every verifiable step in any protocol created (e.g. references/KAIROS.md).

**Good trigger examples:**
- "Create a KAIROS skill for code review" → run this protocol
- "Create skill with KAIROS.md protocol" → run this protocol

**Bad trigger examples:**
- "Run the coding standards" → use kairos-code skill / protocol, not this
- "Create a new KAIROS protocol" (only) → use create-new-protocol protocol first; this protocol builds a full skill

## Step 1: Verify skill directory structure

Verify (or create) the skill directory and layout per the Agent Skills spec.

- **Directory name:** Must match `name` in SKILL.md (lowercase, hyphens, max 64 chars).
- **Required:** `SKILL.md` at skill root.
- **Optional:** `references/`, `scripts/`, `assets/`. Add `references/` when the skill ships docs or a KAIROS protocol; add **`scripts/`** when the skill needs dedicated, runnable tooling (agents run these scripts instead of only generic shell commands); add `assets/` for static files.

Submit a comment (at least 50 characters) confirming the directory path, that SKILL.md exists or will be created, and which optional dirs (if any) are present or planned.

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

## Step 2: Gather requirements and draft SKILL.md

Gather from the user (or infer): purpose and scope, target location (personal `~/.cursor/skills/` or project `.cursor/skills/`), trigger scenarios, key domain knowledge, output format. Draft the skill directory and `SKILL.md` with YAML frontmatter and body.

**Frontmatter:** `name` (required), `description` (required). Optional: `license`, `compatibility`, `metadata`, `allowed-tools` (experimental).

**Body:** Step-by-step instructions, examples, edge cases. Use relative paths for `references/`, `scripts/`, `assets/`. When the skill provides runnable tooling, document how to invoke scripts under `scripts/` (skills give new functionality — we can ship scripts, not depend only on generic shell). Keep file references one level deep.

Submit a comment (at least 80 characters) confirming the draft includes a valid `name` and `description`, the skill path, and whether the skill will bundle a KAIROS protocol (references/KAIROS.md).

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 80 },
    "required": true
  }
}
```

## Step 3: Create protocol via KAIROS (if skill ships a protocol)

If the skill should bundle a KAIROS protocol (per [skills README](../../README.md)):

1. Call `kairos_search` with query **create new KAIROS protocol chain**.
2. Pick the match (or **create** choice) and run that protocol: `kairos_begin` → `kairos_next` (loop) → `kairos_attest`. Follow the protocol to produce a new protocol document (Confirm intent → Gather requirements → Draft markdown → User review → Mint, or equivalent).
3. Save the resulting protocol markdown to **references/KAIROS.md** in the skill directory. If the protocol was minted in KAIROS, you can instead `kairos_dump` that chain with `protocol: true` and save the markdown to references/KAIROS.md. Add YAML frontmatter (`version`, `title`) if desired.
4. Update the skill’s SKILL.md so `metadata.protocol` points to `references/KAIROS.md` and `metadata.protocol_query` is set; add mint-if-missing workflow steps if needed.

If the skill does **not** ship a protocol, state that in your comment and skip to the next step.

Submit a comment (at least 60 characters): either the path to references/KAIROS.md and a one-line summary of the protocol, or "No protocol bundled; skill does not ship a KAIROS protocol."

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 60 },
    "required": true
  }
}
```

## Step 4: Mint protocol (if references/KAIROS.md exists)

If the skill has **references/KAIROS.md** (or another protocol file):

1. Read the file. If it has YAML frontmatter (lines between `---`), strip it so the document starts with the H1.
2. Call `kairos_mint` with the markdown (and required `llm_model_id`; use same space as for any prior KAIROS calls).
3. Report the chain head URI or any error.

If the skill does **not** bundle a protocol, report **No protocol bundled, mint skipped** in your comment.

Submit a comment (at least 20 characters): the chain head URI from `kairos_mint`, or "No protocol bundled, mint skipped", or an error summary.

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 20 },
    "required": true
  }
}
```

## Step 5: Verify protocol by execution (if protocol was minted)

If a protocol was minted in Step 4: run that protocol (or the skill’s workflow) in a **subagent or new chat with no prior context** — e.g. invoke the skill in a fresh session or use a subagent that only has the KAIROS MCP and the skill instructions. Goal: confirm the protocol runs correctly without relying on prior conversation context.

Report outcome in a comment: **pass** or **fail**, and if fail, a short note (e.g. missing step, wrong query, attestation error). If no protocol was minted, state **No protocol to verify; skipped.**

Submit a comment (at least 40 characters) with the result.

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 40 },
    "required": true
  }
}
```

## Step 6: Lint skill

Run **skills-ref validate** on the skill directory (see [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref)):

```bash
skills-ref validate path/to/skill-dir
```

If `skills-ref` is not installed, state that and skip (e.g. "skills-ref not installed; validate manually or install from agentskills/agentskills#skills-ref").

Submit a comment (at least 30 characters): **pass** or **fail** (and errors if any), or **skipped (skills-ref not installed)**.

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 30 },
    "required": true
  }
}
```

## Completion Rule

Only reachable after all prior steps are solved. Deliver to the user: skill path, one-line summary, and (if applicable) minted chain head URI and execution/lint outcome.
