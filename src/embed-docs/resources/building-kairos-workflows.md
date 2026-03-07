# Building KAIROS workflows with challenge/solution

**Purpose:** Primary guide for building KAIROS protocol workflows.
Challenge/solution is the core mechanism: each step defines a
**challenge** (what must be done); execution advances by submitting a
matching **solution** via `kairos_next`. This guide covers document
structure, minting with `kairos_mint`, and solution submission.

---

## Mission

Build KAIROS protocol workflows where challenges (defined per step) are
validated by solutions (submitted in `kairos_next`). Create documents
with `kairos_mint` that define these challenges; maintain exact
consistency between markdown structure and memory chain behavior.

---

## Structure

**Document organization:**

- **H1 (`# Title`)** — defines a protocol chain (one H1 = one chain).
- **Steps** — defined by a trailing ` ```json ` block with
  `{"challenge": {...}}`. H2 headings are used as step labels when
  present in a segment.
- **Challenge** — a fenced ` ```json ` block with `{"challenge": {...}}`
  (same shape as `kairos_begin`/`kairos_next`).

**Memory mapping:**

- Each H1 section → one protocol chain.
- Each challenge block (` ```json ` with `challenge` key) → one memory
  step; content before that block is the step's text.
- Optional content after the last challenge block → final step (no
  proof required).
- H2 in a segment → used as that step's label when present.

**Processing flow:**

```
Markdown document
  ↓
kairos_mint(markdown_doc, llm_model_id)
  ↓
Memory chain (array of memory objects)
  ↓
Each memory has:
  - memory_uuid
  - label (from H2 heading)
  - text (H2 content)
  - proof_of_work (from trailing JSON challenge block)
```

---

## Challenge definitions

Add a trailing ` ```json ` block at the end of each step with an object
that has a `challenge` key. The value is the same shape as the challenge
returned by `kairos_begin`/`kairos_next`; it round-trips with
`kairos_dump`.

**`shell`:**

Example: ```json
{
  "challenge": {
    "type": "shell",
    "shell": { "cmd": "echo \"test\"", "timeout_seconds": 30 },
    "required": true
  }
}
```

**`mcp`:**

Example: ```json
{
  "challenge": {
    "type": "mcp",
    "mcp": { "tool_name": "tool_name", "expected_result": null },
    "required": true
  }
}
```

**`user_input`:**

Example: ```json
{
  "challenge": {
    "type": "user_input",
    "user_input": { "prompt": "Confirm completion" },
    "required": true
  }
}
```

**`comment`:**

Example: ```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

**Parsing rule:** Only the **last** fenced code block in a step is read;
it must be valid JSON with a `challenge` key. The block is stripped from
stored text; the challenge becomes that step's `proof_of_work`.

### Challenge execution semantics

- **`shell`:** Run the command; report `exit_code`/`stdout`/`stderr`.
  Exit code 0 = success.
- **`mcp`:** Call the tool; report `result` and `success`.
- **`user_input`:** Display the prompt to the user; place only their
  reply in `user_input.confirmation`.
- **`comment`:** Provide text meeting the minimum length; the server
  validates relevance to the step.

For agent execution rules (what agents must do per type), see the
`kairos_begin` and `kairos_next` tool descriptions.

---

## MUST ALWAYS

**Document structure:**

- Use H1 (`# Title`) for protocol chain labels.
- Use H2 (`## Step N`) for individual steps.
- Place challenge markers **within** the H2 section they apply to.

**Challenge placement:**

- Place the challenge at the **end** of an H2 section as a single
  trailing ` ```json ` block.
- Only the **last** code block in a step is parsed as the challenge.
- Ensure the opening \`\`\`json is at **line start** (on its own line,
  no prefix). Blocks with text on the same line (e.g. `Example: \`\`\`json`)
  are not parsed as steps.

**`kairos_mint` usage:**

- Pass `markdown_doc` as a string.
- Include `llm_model_id` (e.g. `"minimax/minimax-m2:free"`).
- Use `force_update: true` to overwrite existing chains with the same
  label.

**Solution submission:**

- Submit via `kairos_next(uri, solution)`.
- Solution structure by type:
  - `shell`: `{ type: "shell", shell: { exit_code, stdout, stderr,
    duration_seconds } }`
  - `mcp`: `{ type: "mcp", mcp: { tool_name, arguments, result,
    success } }`
  - `user_input`: `{ type: "user_input", user_input: { confirmation,
    timestamp } }`
  - `comment`: `{ type: "comment", comment: { text } }`

---

## MUST NEVER

**Document structure:**

- Mix H1 and H2 in unpredictable ways.
- Place the challenge JSON block outside the H2 section it ends.
- Use legacy line-based challenge syntax; use only the trailing JSON
  block.

**Challenge definitions:**

- Use the deprecated `proof_of_work` field in API calls; use `solution`
  instead.
- Submit solutions that do not match the challenge type.

**`kairos_mint`:**

- Pass `markdown_doc` as an object — always pass as a string.
- Omit `llm_model_id` — it is required.
- Store duplicate chains without `force_update: true`.

**Workflow:**

- Confuse `challenge` (output from `kairos_next`) with `solution` (input
  to `kairos_next`).
- Use the deprecated `proof_of_work` field; use `solution`.
- Assume step 1 requires a solution submission — step 1 is begun with
  `kairos_begin` only.

---

## Workflow examples

### Example 1: Simple protocol with shell challenges

Use one H1, then one H2 per step. End each step with a ` ```json `
block containing `{"challenge": {...}}`:

```
## Step 1: Initialize
Create the project structure.

```json
{"challenge":{"type":"shell","shell":{"cmd":"mkdir -p project/src","timeout_seconds":10},"required":true}}
```
```

Repeat for Steps 2 and 3 with their own `shell` challenge blocks.

**Execution flow:**

1. `kairos_search("simple setup")` → returns `must_obey: true` with
   `next_action` containing URI.
2. `kairos_begin(uri)` → returns step 1 with `challenge` and
   `next_action` with next URI.
3. `kairos_next(step2_uri, { type: "shell", proof_hash: "...",
   shell: {...} })` → returns step 2.
4. Continue through all steps; echo `proof_hash` from each response.
5. Last `kairos_next` returns `next_action` to call `kairos_attest`.
   Call it to complete the run.

### Example 2: Protocol with comment and user_input challenges

Step 1 ends with a `comment` challenge block; Step 2 with a
`user_input` block.

Step 1 markdown:

```
## Step 1: Review
Review the documentation for accuracy.

```json
{"challenge":{"type":"comment","comment":{"min_length":50},"required":true}}
```
```

Step 2 markdown:

```
## Step 2: Confirm
Confirm review is complete.

```json
{"challenge":{"type":"user_input","user_input":{"prompt":"Type 'approved' to confirm"},"required":true}}
```
```

### Example 3: Multi-chain document

Use two H1 sections (Protocol A, Protocol B). Each H1 creates a
separate chain. Each chain has one or more H2 steps; each step ends with
a ` ```json ` challenge block.

**Result:** Two separate protocol chains are created.

---

## Challenge vs solution nomenclature

- **Challenge** = what `kairos_next` **returns** (what the agent must
  complete).
- **Solution** = what you **submit** to `kairos_next` (proof you
  completed it).

In markdown: use a trailing ` ```json ` block with `{"challenge": {...}}`
per step. The API uses `challenge` (output) and `solution` (input).

---

## Validation rules

| Type | Pass condition |
|------|----------------|
| `shell` | `exit_code === 0` |
| `mcp` | `success === true` |
| `user_input` | Any non-empty `confirmation` |
| `comment` | `text.length` ≥ `challenge.comment.min_length` |

**Step progression:**

- Step 1: no solution required — call `kairos_begin` only.
- Steps 2+: solution required — submit matching `solution`.
- Include `nonce` and `proof_hash` in solution (echo from
  challenge/response).
- Last step: `kairos_next` directs to `kairos_attest`; call attest to
  finalize.

**Error handling (two-phase retry):**

- Retries 1–3: `must_obey: true` with `error_code` and `next_action`
  for recovery.
- After 3 retries: `must_obey: false` — choose to fix the step, abort,
  or ask the user.
- Error responses include `error_code` (e.g. `NONCE_MISMATCH`,
  `TYPE_MISMATCH`) and `retry_count`.

---

## Quick reference

| Operation | Tool | Required fields |
|-----------|------|-----------------|
| Mint document | `kairos_mint` | `markdown_doc`, `llm_model_id` |
| Find protocol | `kairos_search` | `query` |
| Start protocol | `kairos_begin` | `uri` (from `next_action`) |
| Continue step | `kairos_next` | `uri` (from `next_action`), `solution` with `nonce` + `proof_hash` |
| Complete protocol | `kairos_attest` | `uri`, `outcome`, `message` |
