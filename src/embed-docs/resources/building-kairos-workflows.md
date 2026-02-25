# Building KAIROS Workflows with Challenge/Solution

**Status:** Active  
**Purpose:** Primary guide for building KAIROS protocol workflows. **Challenge/Solution** is the core mechanism: each step can define a **challenge** (what must be done) and execution advances by submitting a matching **solution** via `kairos_next`. This doc covers structure, minting with `kairos_mint`, and solution submission.

---

## MISSION

Build KAIROS protocol workflows where **challenges** (defined per step) are validated by **solutions** (submitted in `kairos_next`). Create documents with `kairos_mint` that define these challenges; maintain exact consistency between markdown structure and memory chain behavior.

---

## STRUCTURE

**Document Organization:**
- **H1 (# Title)**: Defines a protocol chain (one H1 = one chain)
- **H2 (## Step N)**: Defines individual steps within the chain
- **Challenge**: A trailing fenced ` ```json ` block at the end of each step with `{"challenge": {...}}` (same shape as kairos_begin/kairos_next)

**Memory Mapping:**
- Each H1 section → One protocol chain
- Each H2 section → One memory step
- Trailing JSON challenge block within a step → Becomes `proof_of_work` metadata on that memory

**Processing Flow:**
```
Markdown Document
  ↓
kairos_mint(markdown_doc, llm_model_id)
  ↓
Memory Chain (array of Memory objects)
  ↓
Each Memory has:
  - memory_uuid
  - label (from H2 heading)
  - text (H2 content)
  - proof_of_work (from trailing JSON challenge block)
```

---

## CONTENT TYPES

### Challenge Definitions

Add a **trailing** ` ```json ` block at the end of each step with an object that has a `challenge` key. The value is the same shape as the challenge returned by kairos_begin/kairos_next; it round-trips with kairos_dump.

**Shell (`shell`):**
```json
{
  "challenge": {
    "type": "shell",
    "shell": { "cmd": "echo \"test\"", "timeout_seconds": 30 },
    "required": true
  }
}
```

**MCP (`mcp`):**
```json
{
  "challenge": {
    "type": "mcp",
    "mcp": { "tool_name": "tool_name", "expected_result": null },
    "required": true
  }
}
```

**User Input (`user_input`):**
```json
{
  "challenge": {
    "type": "user_input",
    "user_input": { "prompt": "Confirm completion" },
    "required": true
  }
}
```

**Comment (`comment`):**
```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

**Parsing:** Only the **last** fenced code block in a step is read; it must be valid JSON with a `challenge` key. The block is stripped from stored text; the challenge becomes that step's `proof_of_work`.

### Challenge Types (execution)

**Shell:** Run the command; report exit_code/stdout/stderr. Exit code 0 = success.

**MCP:** Call the tool; report result and success.

**User Input:** Show the prompt to the user; use only their reply as `user_input.confirmation`.

**Comment:** Provide text meeting the minimum length; validated for relevance to the step.

For execution semantics (how agents must perform each challenge type), see the kairos_begin and kairos_next tool descriptions.

---

## MUST ALWAYS

### Document Structure
- Use H1 (`# Title`) for protocol chain labels
- Use H2 (`## Step N`) for individual steps
- Place challenge markers **within** the H2 section they apply to
- Each H1 creates a separate protocol chain

### Challenge Placement
- Place the challenge **at the end** of an H2 section as a single trailing ` ```json ` block
- Only the **last** code block in a step is parsed as the challenge (if multiple blocks exist)

### kairos_mint Usage
- Always provide `markdown_doc` as a string (can be JSON stringified)
- Always provide `llm_model_id` (e.g., `"minimax/minimax-m2:free"`)
- Use `force_update: true` to overwrite existing chains with the same label

### Solution Submission
- Use `kairos_next(uri, solution)` to submit solutions (not `proof_of_work`)
- Solution structure matches challenge type:
  - `shell`: `{type: 'shell', shell: {exit_code, stdout, stderr, duration_seconds}}`
  - `mcp`: `{type: 'mcp', mcp: {tool_name, arguments, result, success}}`
  - `user_input`: `{type: 'user_input', user_input: {confirmation, timestamp}}`
  - `comment`: `{type: 'comment', comment: {text}}`

---

## MUST NEVER

### Document Structure
- **NEVER** mix H1 and H2 in unpredictable ways
- **NEVER** place the challenge JSON block outside an H2 section (it applies to the step it ends)
- **NEVER** use legacy line-based challenge syntax; use only the trailing JSON block

### Challenge Definitions
- **NEVER** use the old `proof_of_work` field in API calls (use `solution` instead)
- **NEVER** skip challenge validation - `kairos_next` requires solutions for steps with challenges
- **NEVER** submit solutions that don't match the challenge type

### kairos_mint
- **NEVER** pass markdown as an object - always as a string
- **NEVER** omit `llm_model_id` - it's required
- **NEVER** store duplicate chains without `force_update: true`

### Workflow Confusion
- **NEVER** confuse `challenge` (output from `kairos_next`) with `solution` (input to `kairos_next`)
- **NEVER** use `proof_of_work` field - it's deprecated, use `solution`
- **NEVER** assume step 1 requires a solution (only steps 2+ require solutions)

---

## WORKFLOW EXAMPLES

### Example 1: Simple Protocol with Shell Challenges

Use one H1, then one H2 per step. End each step with a fenced ` ```json ` block containing `{"challenge": {...}}`. Example for one step:

    ## Step 1: Initialize
    Create the project structure.

    ```json
    {"challenge":{"type":"shell","shell":{"cmd":"mkdir -p project/src","timeout_seconds":10},"required":true}}
    ```

Repeat for Step 2 and Step 3 with their own `shell` challenge blocks (same shape, different `cmd`).

**Minting:**
```javascript
await kairos_mint({
  markdown_doc: markdownText,
  llm_model_id: 'minimax/minimax-m2:free'
});
```

**Execution Flow:**
1. `kairos_search("simple setup")` -> Returns `must_obey: true` with `next_action` containing URI
2. `kairos_begin(uri)` -> Returns step 1 with `challenge` and `next_action` with next URI
3. `kairos_next(step2_uri, solution: {type: 'shell', proof_hash: '...', shell: {...}})` -> Returns step 2
4. Continue through all steps with solutions (echo `proof_hash` from each response)
5. Last `kairos_next` returns `next_action` to call kairos_attest; call it to complete the run

### Example 2: Protocol with Comment Challenge

Step 1 ends with a comment challenge block; Step 2 with a user_input block. Example for Step 1:

    ## Step 1: Review
    Review the documentation for accuracy.

    ```json
    {"challenge":{"type":"comment","comment":{"min_length":50},"required":true}}
    ```

Step 2: use `{"challenge":{"type":"user_input","user_input":{"prompt":"Type 'approved' to confirm"},"required":true}}` in its trailing JSON block.

**Solution Submission:**
```javascript
// For step 1 (comment challenge)
await kairos_next(step1_uri, {
  solution: {
    type: 'comment',
    comment: {
      text: 'Reviewed documentation. All sections are accurate and up-to-date. No changes needed.'
    }
  }
});

// For step 2 (user input challenge)
await kairos_next(step2_uri, {
  solution: {
    type: 'user_input',
    user_input: {
      confirmation: 'approved',
      timestamp: new Date().toISOString()
    }
  }
});
```

### Example 3: Multi-Chain Document

Use two H1 sections (Protocol A, Protocol B). Each H1 creates a separate chain. Each can have one or more H2 steps; each step ends with a ` ```json ` block with `{"challenge": {...}}` as above.

**Result:** Two separate protocol chains are created (one for Protocol A, one for Protocol B).

---

## CHALLENGE vs SOLUTION NOMENCLATURE

**Important Distinction:**
- **Challenge** = What `kairos_next` **returns** (what the AI must complete)
- **Solution** = What you **submit** to `kairos_next` (proof you completed it)

**In Markdown:** Use a trailing ` ```json ` block with `{"challenge": {...}}` per step. Internal representation is `proof_of_work`; API uses `challenge` (output) and `solution` (input).

---

## VALIDATION RULES

### Challenge Validation
- Shell challenges: Exit code 0 = success, non-zero = failure
- MCP challenges: `success: true` required
- User input: Any non-empty `confirmation` accepted
- Comment challenges: Minimum length enforced (default: 10 chars)

### Step Progression
- Step 1 (first H2): **No solution required** - call `kairos_begin` only
- Steps 2+: **Solution required** - must submit matching `solution` to proceed
- Include `nonce` and `proof_hash` in solution (echo from challenge/response)
- Protocol completion: Last `kairos_next` directs to kairos_attest; call attest to finalize

### Error Handling (Two-Phase Retry)
- Retries 1-3: `must_obey: true` with `error_code` and `next_action` for recovery
- After 3 retries: `must_obey: false` - AI gets autonomy (fix step, abort, or ask user)
- Error responses include `error_code` (e.g., `NONCE_MISMATCH`, `TYPE_MISMATCH`) and `retry_count`

---

## MIGRATION FROM OLD WORKFLOW

**Old Way (Deprecated):**
```javascript
kairos_next(uri, {proof_of_work: {...}})  // ❌ Deprecated
```

**New Way (Current):**
```javascript
kairos_next(uri, {solution: {...}})  // ✅ Correct
```

**Field Mapping:**
- `proof_of_work` → `solution`
- Structure remains the same (type-specific fields unchanged)
- Validation logic unchanged

---

## QUICK REFERENCE

| Operation | Tool | Required Fields |
|-----------|------|----------------|
| Mint document | `kairos_mint` | `markdown_doc`, `llm_model_id` |
| Find protocol | `kairos_search` | `query` |
| Start protocol | `kairos_begin` | `uri` (from `next_action`) |
| Continue step | `kairos_next` | `uri` (from `next_action`), `solution` with `nonce` + `proof_hash` |
| Complete protocol | `kairos_attest` | `uri`, `outcome`, `message` |

---

## COMMON PITFALLS

1. **Forgetting solutions for step 2+**: Every step after step 1 requires a solution if it has a challenge
2. **Wrong solution type**: Solution type must exactly match challenge type
3. **Skipping validation**: Challenges are enforced - you cannot proceed without valid solutions
4. **Using old field names**: Always use `solution`, never `proof_of_work` in API calls
5. **Mixing H1 chains**: Each H1 creates a separate chain - don't mix steps between chains

---

**Last Updated:** 2025-12-08  
**Related:** `kairos_mint`, `kairos_next`, `kairos_begin`, `kairos_attest`
