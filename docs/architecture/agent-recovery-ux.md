# Agent recovery UX — reducing step-skipping

**Audience:** UX and API design. **Users:** AI agents executing KAIROS protocols.

## Why this doc

Models tend to skip steps: they infer, assume, or fabricate instead of performing the step. KAIROS exists to enforce step-by-step execution. When an agent skips a step (e.g. invents user confirmation instead of asking the user), the system should make it easy to **recognise the mistake and recover** — not just fail with a generic error.

## Design principle

**Errors teach; recovery is in the error.** For each challenge type, when proof is missing or invalid, the server should tell the agent *exactly* what to do next in the **message** and **next_action**, so the agent can correct without guessing.

## Challenge-type-specific recovery

When `kairos_next` returns `MISSING_PROOF` (previous step not proven), the response should be tailored to the **previous step’s challenge type**:

| Type | Risk | What to put in message / next_action |
|------|------|--------------------------------------|
| **user_input** | Agent infers or invents confirmation instead of asking the user. | Tell the agent: you must obtain the user’s **actual** reply. Include the exact prompt to show: *“Ask the user: «prompt»”*. Then: *“Call kairos_next with solution.user_input.confirmation set to their reply. Do not infer or invent.”* Embed the retry URI in `next_action`. |
| **shell** | Agent fabricates exit_code/stdout. | Already: *“Execute «cmd» and report the result before continuing.”* Keep embedding the command. |
| **mcp** | Agent invents tool result. | *“Call the MCP tool «tool_name» and report its real result, then call kairos_next with solution.mcp (success and result). Do not fabricate.”* |
| **comment** | Agent pastes unrelated text or too short. | *“Write a genuine summary of what was done (min N characters) and call kairos_next with solution.comment.text. Do not paste unrelated text.”* |

## Implementation notes

- **Where:** In `kairos_next`, when building the MISSING_PROOF response (e.g. in `ensurePreviousProofCompleted` or the caller), use the **previous** step’s `proof_of_work.type` and type-specific fields (e.g. `user_input.prompt`) to build the message and an optional override for `next_action`.
- **Stability:** Keep `error_code` as `MISSING_PROOF` for monitoring. Add no new required fields; only enrich message and next_action.
- **Agent-facing:** `next_action` should remain copy-paste friendly (exact URI, clear instruction). Message can be longer and explanatory.

## Checklist for new challenge types

When adding a new proof type:

1. Define the “skip” risk: what would an agent do instead of performing the step?
2. Write the recovery sentence: what must the agent do to fix it?
3. Include that sentence (and any concrete values, e.g. prompt or command) in the MISSING_PROOF message and, if helpful, in next_action.

## Reference

- CONTRIBUTING.md § Agent-facing design principles (errors teach; next_action in errors).
- Workflow test run that triggered this: reports/workflow-2026-02-24-143000 (user_input protocol; agent fabricated confirmation; MISSING_PROOF did not tell the agent to ask the user).
