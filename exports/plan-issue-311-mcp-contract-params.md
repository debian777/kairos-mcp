# Plan: MCP proof contract — tool name + parameters (issue #311)

Branch: `feat/mcp-contract-tool-params`  
Worktree: `kairos-mcp-feat-mcp-contract-tool-params` (sibling of main repo)  
Issue: https://github.com/debian777/kairos-mcp/issues/311

## Goal

Let adapter authors specify **which MCP tool** must be called and **which arguments** must be supplied (or matched), and have **`forward`** verification enforce that against `solution.mcp` instead of only recording self-reported `success`.

## Non-goals (this iteration)

- Proving the agent actually invoked a real MCP server (no host-side attestation).
- Replacing trust in `mcp.success` entirely (can be a follow-up: require `expected_result` matching, etc.).

## 1. Contract shape

**Add optional `mcp.arguments`** on the layer contract (Zod: `z.record(z.unknown())` or `z.any()` with documented semantics), aligned with submission field **`solution.mcp.arguments`**.

- **Naming:** Prefer **`arguments`** on both contract and solution (already true for solution) to avoid a second name (`parameters`) in the wire format.
- **Semantics when absent:** No argument constraints (current behavior).
- **Semantics when present:** Submission must include `mcp.arguments` such that it **matches** the contract (see §3).

Update:

- `src/tools/forward_schema.ts` — `forwardContractSchema.mcp`
- Any duplicate contract schemas (search for `tool_name` + `mcp` object)
- `src/tools/next_schema.ts` if it mirrors contract display
- Types in `src/types/memory.ts` or adjacent if `ProofOfWorkDefinition` is hand-maintained

## 2. Challenge text / UI

- `src/tools/next-pow-helpers.ts` — `buildChallengeShapeForDisplay`: include expected `arguments` in description and in returned `mcp` payload when set.
- `src/ui/components/run/runContractChallenge.ts` — pass through expected args for MCP challenge card if the UI should show them.
- `src/tools/kairos-challenge-display.ts` — if MCP challenges are summarized for agents, mention required args.

## 3. Validation rules (`next-pow-helpers` or shared helper)

On `proofType === 'mcp'` after field presence checks:

1. **Tool name:** If contract has `mcp.tool_name`, require `submission.mcp.tool_name === contract.mcp.tool_name` (normalize case? default: **case-sensitive** match with existing tool naming).
2. **Arguments:** If contract has `mcp.arguments`:
   - Require `submission.mcp.arguments` to be an object (or accept `undefined` only if contract allows empty — prefer explicit `{}` in contract for “no args”).
   - **Match strategy (v1):** Deep equality with **stable key order ignored** — implement `isDeepSubset` or “contract keys must equal submission values for those keys”:
     - **Option A (recommended):** Contract specifies required keys only; submission may contain extra keys (lenient).
     - **Option B:** Full deep equality (strict). Document choice in embed-docs.

If validation fails → existing `blocked(...)` pattern with a new error code (e.g. `MCP_TOOL_MISMATCH`, `MCP_ARGUMENTS_MISMATCH`).

## 4. Tests

- **Unit:** Zod accepts/rejects contract JSON with `mcp.arguments`; helper tests for argument matching edge cases (nested objects, arrays, missing keys).
- **Integration:** Extend or add a `forward` test that submits MCP proof with wrong tool or wrong args and expects failure; happy path with matching tool + args succeeds.

Search targets: `next-pow-helpers`, `v4-kairos-forward`, `forward-first-call`.

## 5. Documentation

- `src/embed-docs/tools/` — **`forward`** (and **`next`** if it lists contract fields): document `mcp.arguments` and validation behavior.
- `docs/examples/adapter-example-mcp.md` — example block with optional `arguments`.
- Issue #311 — comment with PR link when implemented.

## 6. Backward compatibility

Existing adapters without `mcp.arguments` keep current behavior. Adding **tool_name** enforcement may break adapters where agents reported a different tool name than the contract; grep tests and examples for `type: "mcp"` before enabling strict tool match — if any rely on loose behavior, gate strict match behind presence of explicit flag **or** accept that fixing #311 is intentionally stricter (prefer strict tool name whenever contract has `tool_name`, since that is already the intended meaning).

## 7. Validation in dev

Per `AGENTS.md`: `npm run dev:deploy && npm run dev:test` before merge.

## Checklist

- [ ] Schema + types updated
- [ ] Display / challenge copy updated
- [ ] Verification + error codes
- [ ] Unit + integration tests
- [ ] Embed-docs + example adapter
- [ ] Lint on touched files
