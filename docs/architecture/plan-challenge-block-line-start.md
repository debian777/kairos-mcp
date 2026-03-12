# Plan: Challenge block at line start only

**Status:** Draft  
**Goal:** Only treat ` ```json ` challenge blocks as steps when the opening fence is at **line start**. This lets reference docs use inline labels (e.g. `Example: ```json`) so those blocks are not parsed, while keeping current agent/forge behaviour unchanged.

---

## Phase 1: Code change

### 1.1 Parser – only match fence at line start

**File:** `src/services/memory/chain-builder-proof.ts`

**Current:** `ANY_JSON_BLOCK_REGEX = /```(?:json)?\s*\n([\s\S]*?)```/g` matches any ``` or ```json in the content.

**Change:** Match only when the opening fence is at **start of content** or **immediately after a newline** (no text or spaces before ``` on that line).

- Replace `ANY_JSON_BLOCK_REGEX` with a pattern that requires `(^|\n)` before the opening ```.
- Option A (multiline): `/(?:^|\n)```(?:json)?\s*\n([\s\S]*?)```/gm` and adjust `exec` loop to use `match.index` correctly (index may be the capture start, not the ```).
- Option B (manual scan): Iterate over lines or use a regex that captures the position of the ``` after newline; ensure `match.index` points to the start of the opening ``` for existing `start`/`end` semantics.

**Constraint:** Preserve existing behaviour for all content that already has ```json at line start (no leading text on the same line). No change to JSON parsing or `challenge` key check.

### 1.2 Trailing-block regex (if used for steps)

**File:** `src/services/memory/chain-builder-proof.ts`

**Current:** `TRAILING_JSON_BLOCK_REGEX = /([\s\S]*)\n```(?:json)?\s*\n([\s\S]*?)```\s*$/` — already requires `\n` before the fence, so it only matches line-start fences at the end. Confirm no change needed, or align with the same “line start” rule for consistency.

### 1.3 Tests

- **Unit:** Add or extend tests in `src/services/memory/` (or `tests/`) that:
  - Parse content with `\n```json\n{"challenge":{...}}\n```` → block is found.
  - Parse content with `Example: ```json\n{"challenge":{...}}\n```` → block is **not** found.
  - Parse content with multiple line-start challenge blocks → all found, step count unchanged.
- **Integration:** Run existing kairos_mint / chain tests; ensure no regressions (forged and in-repo protocols use line-start ```json).

**Acceptance:** All current mint/chain tests pass; new tests confirm line-start-only behaviour.

---

## Phase 2: Protocol / doc updates (after code ships)

### 2.1 Create New Protocol mem (2001)

**File:** `src/embed-docs/mem/00000000-0000-0000-0000-000000002001.md`

Once the parser only considers line-start fences:

- In **reference / example** sections (e.g. “Why use a challenge”, “Challenge types”, “Example protocol (for inspiration)”, “Example step format”), prefix the opening fence with a short label so it is no longer at line start, e.g.  
  `Example: ```json`  
  or  
  `Format: ```json`  
  so those blocks are **not** parsed as steps.
- Leave **executable** steps (## Step 1 … ## Step 5) with ` ```json ` at line start so they remain the only parsed steps.

**Acceptance:** After mem inject/boot, the “Create New KAIROS Protocol Chain” chain has exactly five steps (Confirm Intent → Mint Protocol); no extra steps from example blocks.

### 2.2 Optional: other embed-docs

If any other file in `src/embed-docs/` mixes real steps and example challenge blocks, apply the same pattern: line-start ```json = parsed; inline-prefixed (e.g. `Example: ```json`) = not parsed.

---

## Phase 3: Documentation (“just in case”)

### 3.1 Require challenge block at line start

Add a single, explicit rule so future authors and agents always put the opening fence on its own line.

**Suggested places:**

- **`src/embed-docs/tools/kairos_mint.md`**  
  In “Challenge block format” or “MUST ALWAYS”:  
  - “Start the challenge block on a **new line**: the line must begin with \`\`\`json (or \`\`\`) with no text before it. Blocks with text on the same line (e.g. \`Example: \`\`\`json) are not parsed as steps.”

- **`src/embed-docs/resources/building-kairos-workflows.md`**  
  In “Challenge definitions” or “Document structure”:  
  - “Place the \`\`\`json block at the **end** of the step and ensure the opening \`\`\`json is at **line start** (new line, no prefix).”

- **`AGENTS.md`** (Minting and editing protocols)  
  - “End every verifiable step with a trailing \`\`\`json block … The opening \`\`\`json must be on its own line (line start).”

**Acceptance:** Docs state clearly that the challenge fence must start the line; no new “MUST” that conflicts with existing behaviour.

---

## Order of work

1. **Phase 1** – Parser + tests, then merge. No doc or protocol change yet.
2. **Phase 2** – After parser is released, update 2001 (and any similar mems) to use `Example: ```json` (or equivalent) in reference sections.
3. **Phase 3** – Add “line start” to tool/workflow/AGENTS docs at any time (can be with Phase 1 or 2).

---

## Risks and rollback

- **Risk:** A protocol somewhere uses a single line like `Do this: ```json\n{...}\n````. Reality check (forged + kairos-mcp-ui) found no such case; all real challenge blocks are at line start.
- **Rollback:** Revert the regex change in `chain-builder-proof.ts` to restore “match any ```” behaviour; no need to revert doc/protocol changes (they remain valid either way).
