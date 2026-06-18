# Fix Reward URI Bug and Chain Link Validation

## Problem Analysis

The adapter-migration protocol fails at the reward step with "Memory with ID 00000000-0000-0000-0000-000000002010 not found for quality update". This occurs because:

1. **Root cause:** The adapter-migration protocol is defined as a static markdown file in `src/embed-docs/mem/00000000-0000-0000-0000-000000002010.md`, but it was never trained/registered in Qdrant as an actual adapter.

2. **Why reward fails:** The reward tool (`src/tools/reward.ts` line 31-33) requires a layer URI and looks up the memory record in Qdrant. Since adapter-migration was never trained, no memory record exists.

3. **Agent confusion:** The server's `next_action` correctly points to the layer URI (as required by reward tool design), but the agent mistakenly believed it should use an adapter URI instead.

**Key finding:** The reward tool is correctly designed to accept layer URIs, not adapter URIs. The bug is that adapter-migration exists as documentation but not as a trained adapter in Qdrant.

## Solution Approach

Four-part fix:
1. **Immediate:** Train the adapter-migration protocol into Qdrant so reward can find it
2. **Preventive (ESLint):** Add forbidden pattern for hardcoded layer URIs in source code
3. **Preventive (train/tune):** Validate URI format in contract blocks (hard error) and warn on missing references
4. **Documentation:** Clarify reward URI requirements

## Implementation Tasks

### Task 1: Train adapter-migration protocol into Qdrant
**File:** `src/embed-docs/mem/00000000-0000-0000-0000-000000002010.md`
**Action:** Use the `train` tool to register this adapter
- Call `train` with the adapter-migration markdown content
- This will create memory records in Qdrant for each layer
- After training, reward will be able to find the memory records

**Validation:**
- After training, verify the adapter appears in `spaces` tool output
- Test the full activate → forward → reward chain

### Task 2: Add preflight check for protocol training status
**File:** `src/tools/activate.ts` or new validation module
**Action:** When activating a protocol, verify it exists in Qdrant
- Check if the protocol's memory records exist before starting execution
- If not found, return clear error: "Protocol X is documented but not trained. Run train before activation."
- This prevents agents from executing untrained protocols

**Validation:**
- Test with adapter-migration before training (should fail with clear message)
- Test with adapter-migration after training (should succeed)

### Task 3: Update embed-docs build process
**File:** `scripts/build-embed-docs.ts` or similar
**Action:** Ensure embed-docs markdown files are auto-trained during build
- When markdown files are added to `src/embed-docs/mem/`, automatically train them
- Or add a CI check that verifies all embed-docs have corresponding Qdrant records
- This prevents future protocols from being documentation-only

**Validation:**
- Add a test that verifies all files in `src/embed-docs/mem/*.md` have trained records
- CI should fail if documentation exists without training

### Task 4: Add ESLint forbidden pattern for hardcoded layer URIs
**File:** `eslint/plugins/kairos-forbidden-text.cjs`
**Action:** Add regex pattern to ban hardcoded layer URIs with UUID patterns
- Pattern: `/kairos:\/\/layer\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi`
- Allow in test files (`tests/`), documentation (`src/embed-docs/`, `docs/`), and the URI parser itself (`src/tools/kairos-uri.ts`)
- This prevents agents from hardcoding layer URIs in source code

**Validation:**
- Run ESLint on source files to verify pattern is caught
- Verify allowed files are excluded

### Task 5: Add URI format validation and server field in contract blocks during train/tune
**File:** `src/services/memory/validate-protocol-structure.ts`
**Action:** Validate URI format in `mcp.arguments.uri` fields **only when the URI starts with `kairos://`** and enforce server field for non-KAIROS MCP tools
- After line 153, add checks:
  1. If `mcp.arguments.uri` exists and starts with `kairos://`, validate format using `parseKairosUriOrThrow`
  2. **Slug-only enforcement:** In train/tune, only accept `kairos://adapter/{slug}` format (not UUID format) for KAIROS URIs
  3. **Server field requirement:** For non-KAIROS MCP tools, `mcp.server` field is REQUIRED to disambiguate tool sources
  4. **Tool name validation:** Ensure `tool_name` is a simple string (no server prefixes like `server__tool` or `project-0-server-tool`)
- This catches malformed KAIROS URIs at training time and ensures unambiguous MCP tool references

**Revised contract format with server field:**
```json
// VALID (KAIROS internal tool - server optional/omitted):
{"contract":{"type":"mcp","mcp":{"tool_name":"forward","arguments":{"uri":"kairos://adapter/phase-critic"}}}}

// VALID (non-KAIROS MCP tool - server REQUIRED):
{"contract":{"type":"mcp","mcp":{"server":"atlassian","tool_name":"getMergeRequest","arguments":{"repo":"X"}}}}

// INVALID (KAIROS URI with UUID - rejected in train/tune):
{"contract":{"type":"mcp","mcp":{"tool_name":"forward","arguments":{"uri":"kairos://adapter/00000000-0000-0000-0000-000000002009"}}}}

// INVALID (server-prefixed tool name - rejected):
{"contract":{"type":"mcp","mcp":{"server":"atlassian","tool_name":"atlassian__getMergeRequest","arguments":{"repo":"X"}}}}

// INVALID (non-KAIROS tool without server field - rejected):
{"contract":{"type":"mcp","mcp":{"tool_name":"getMergeRequest","arguments":{"repo":"X"}}}}
```

**AI UX rationale:**
- Multiple MCP servers can have tools with the same name (e.g., `getMergeRequest` in both `atlassian` and `github` servers)
- The `server` field disambiguates which server to call
- The agent resolves to fully-qualified name (e.g., `atlassian__getMergeRequest` or Cursor's `project-0-atlassian-getMergeRequest`)
- KAIROS internal tools (forward, reward, train, etc.) can omit `server` or use `server: "kairos"`

**Validation:**
- Add unit tests for `validateProtocolStructure` with valid/invalid KAIROS URIs
- Test that non-KAIROS MCP tools REQUIRE `server` field
- Test that server-prefixed tool names are rejected
- Test that UUID format is rejected in train/tune but accepted in other tools

### Task 6: Add existence validation as WARN during train/tune
**File:** `src/tools/train-store.ts` and `src/tools/tune-execute.ts`
**Action:** After parsing adapter content, scan for `kairos://adapter/{slug}` references and warn if targets don't exist
- For each reference, check if the target adapter exists in Qdrant
- If not found, emit a WARNING (not error) in the training response
- Example warning: `"Adapter reference 'phase-critic' not found. This may be a forward reference for multi-chain bootstrapping."`
- This helps catch typos and broken links early while allowing multi-chain bootstrapping

**Validation:**
- Test with adapter referencing existing adapter (no warning)
- Test with adapter referencing non-existing adapter (warning emitted)
- Verify training still succeeds (warn-only, not blocking)

### Task 7: Clarify reward URI documentation
**File:** `src/embed-docs/tools/reward.md`
**Action:** Add explicit note about layer URI requirement
- Current line 23 says "Use only layer URIs returned by forward"
- Add: "The layer URI is provided in the forward response's next_action field. Do not substitute adapter URIs."
- This prevents agent confusion about which URI to use

**Validation:**
- Review by agent-protocol-expert skill
- Test that agents follow the clarified documentation

## Dependencies

- Task 1 must be completed first (training adapter-migration)
- Task 2, 3, 4, 5, 6 can be done in parallel after Task 1
- Task 7 is independent and can be done anytime

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Training adapter-migration changes its URI | Use the existing file path as the source; training will assign proper layer URIs |
| Auto-training embed-docs slows CI | Only train when files change; cache trained state |
| Agents still confused about reward URI | Add examples to reward.md showing correct vs incorrect usage |
| ESLint pattern catches legitimate uses | Allow in test files, documentation, and URI parser |
| Slug-only enforcement breaks existing adapters | Only enforce in train/tune; retain UUID backward compat in forward/reward |
| Existence validation produces false positives | Warn-only, not blocking; allows multi-chain bootstrapping |

## Rejected Alternatives

**Alternative 1: Change reward to accept adapter URIs**
- **Why rejected:** The reward tool is correctly designed to work with layer URIs. The layer URI carries execution context (execution_id) that the adapter URI doesn't have. Changing this would break the execution trace system.

**Alternative 2: Skip reward for documentation-only protocols**
- **Why rejected:** This creates two classes of protocols (trained vs untrained) and makes the system unpredictable. All protocols should be trained to ensure consistent behavior.

**Alternative 3: Agent should have used adapter URI instead of layer URI**
- **Why rejected:** The agent was correct to follow the server's next_action which specified the layer URI. The server's guidance was correct; the bug is that the protocol wasn't trained.

## Critical Files

1. `src/embed-docs/mem/00000000-0000-0000-0000-000000002010.md` - adapter-migration protocol source
2. `src/tools/reward.ts` - reward tool implementation (lines 27-34)
3. `src/tools/next.ts` - next_action generation (line 79)
4. `src/embed-docs/tools/reward.md` - reward tool documentation
5. `scripts/build-embed-docs.ts` - embed-docs build process (to be created/modified)
6. `eslint/plugins/kairos-forbidden-text.cjs` - ESLint forbidden patterns
7. `src/services/memory/validate-protocol-structure.ts` - protocol structure validation
8. `src/tools/train-store.ts` - train store implementation
9. `src/tools/tune-execute.ts` - tune execution