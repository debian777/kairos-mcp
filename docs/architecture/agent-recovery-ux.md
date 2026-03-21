# Agent recovery UX — reducing step-skipping

Models tend to skip steps: they infer, assume, or fabricate instead of
performing the work. KAIROS enforces step-by-step execution. When an agent
skips a step (for example, inventing a user confirmation instead of asking
the user), the system must make it easy to recognize the mistake and
recover — not just return a generic error.

## Design principle

**Errors teach; recovery is in the error.** For each challenge type, when
proof is missing or invalid, the server tells the agent exactly what to
do next in `message` and `next_action` so the agent can correct without
guessing.

## Challenge-type-specific recovery

When `forward` returns `MISSING_PROOF` (previous step not proven),
tailor the response to the **previous step's challenge type**:

| Type | Risk | What to put in message / next_action |
|------|------|--------------------------------------|
| **user_input** | Agent infers or invents confirmation instead of asking the user. | Tell the agent: you must obtain the user's actual reply. Include the exact prompt: "Ask the user: «prompt»". Then: "Call forward with `solution.user_input.confirmation` set to their reply. Do not infer or invent." Embed the retry URI in `next_action`. |
| **shell** | Agent fabricates `exit_code`/`stdout`. | "Execute «cmd» and report the result before continuing." Keep embedding the command. |
| **mcp** | Agent invents tool result. | "Call the MCP tool «tool_name» and report its real result, then call forward with `solution.mcp` (success and result). Do not fabricate." |
| **comment** | Agent pastes unrelated text or writes too little. | "Write a genuine summary of what was done (min N characters) and call forward with `solution.comment.text`. Do not paste unrelated text." |

## Implementation notes

- **Where:** In `forward`, when building the `MISSING_PROOF` response
  (for example, in `ensurePreviousProofCompleted` or its caller), use the
  **previous** step's `proof_of_work.type` and type-specific fields (for
  example, `user_input.prompt`) to build the `message` and an optional
  override for `next_action`.
- **Stability:** Keep `error_code` as `MISSING_PROOF` for monitoring. Add
  no new required fields; only enrich `message` and `next_action`.
- **Agent-facing:** `next_action` must remain copy-paste friendly (exact
  URI, clear instruction). `message` may be longer and explanatory.

## Checklist for new challenge types

When adding a new proof type:

1. Define the skip risk: what would an agent do instead of performing the
   step?
2. Write the recovery sentence: what must the agent do to fix it?
3. Include that sentence (and any concrete values, for example prompt
   text or command) in the `MISSING_PROOF` message and, when helpful, in
   `next_action`.

## See also

- [CONTRIBUTING.md — Agent-facing design principles](../../CONTRIBUTING.md#agent-facing-design-principles)
  (errors teach; `next_action` in errors)
- [forward workflow](workflow-kairos-next.md) — error codes and
  recovery paths
