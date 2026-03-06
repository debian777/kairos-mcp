> **Note:** This document describes a design decision made in February 2026.
> The bug fix and the `kairos_attest`-as-last-step design are both
> implemented. See the agreed decisions at the top of this document.

# MISSING_PROOF fix: JSON examples

Two-step protocol (step 1 = `user_input` "Confirm deployment", step 2 =
last step, no challenge). The agent follows `next_action` and calls
`kairos_next(uri=step2, solution=step1_solution)`.

## Agreed decisions

- **MISSING_PROOF fix:** Bug confirmed; fix implemented. When the agent
  calls `kairos_next(uri=step_with_no_proof, solution=for_previous_step)`,
  the server validates and stores the solution against the **previous**
  step, then continues (`ensurePreviousProofCompleted` passes; quality uses
  the completed previous step). Same behavior for MCP and HTTP API. Code:
  `src/tools/kairos_next.ts`, `src/http/http-api-next.ts`; helpers:
  `handleProofSubmission`, `ensurePreviousProofCompleted`,
  `resolveChainPreviousStep`, `loadMemoryWithCache`.
- **kairos_attest as last step:** Agreed design (MCP/agent UX). When there
  are no more content steps, `next_action` always directs the agent to call
  `kairos_attest`. This gives deterministic completion (single pattern:
  "call kairos_attest" vs ambiguous "Run complete"), explicit outcome and
  message, and simpler `must_obey` handling.

## Sample kairos_begin

The agent starts the protocol with the chain head URI (from search or
mint). Step 1 has a `user_input` challenge; `next_action` tells the agent
to call `kairos_next` with **step 2's URI** and a solution matching the
challenge.

### Request

```json
{
  "uri": "kairos://mem/95e58776-942a-41dc-9b03-b2fc45edabd1"
}
```

### Response

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/95e58776-942a-41dc-9b03-b2fc45edabd1",
    "content": "Ask the user to approve deployment. The agent must obtain confirmation and send it in the solution.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "user_input",
    "description": "User confirmation: Approve deployment to production?. You MUST show this prompt to the user and use only their reply as user_input.confirmation; do not assume or invent it.",
    "user_input": { "prompt": "Approve deployment to production?" },
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "nonce": "86e77edabbd060ae513f7196bc43c864"
  },
  "next_action": "call kairos_next with kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09 and solution matching challenge"
}
```

The agent performs the challenge (gets user confirmation) and calls
`kairos_next` with `uri: "kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09"`
(step 2) and the solution for step 1. The sections below show what
happened before and after the fix.

## 1. Original bug

The agent calls `kairos_next` with the **next** step URI (step 2) and the
solution for **step 1**. The server loads step 2 (no `proof_of_work`),
does not apply the solution to step 1, runs
`ensurePreviousProofCompleted` → step 1 has no stored result →
**MISSING_PROOF**.

### Request (agent follows next_action from kairos_begin)

```json
{
  "uri": "kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09",
  "solution": {
    "type": "user_input",
    "user_input": { "confirmation": "Yes, approved." },
    "nonce": "86e77edabbd060ae513f7196bc43c864",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e"
  }
}
```

### Response (bug: MISSING_PROOF)

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09",
    "content": "Only reachable after Step 1 is solved. Show the output from Step 1 to the user.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "comment",
    "description": "Provide a verification comment...",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "nonce": "674330d0e2b3cd1a8887c9d8ad636ba2"
  },
  "message": "Proof of work missing for Confirm deployment. Complete the required user_input verification before continuing.",
  "next_action": "retry kairos_next with kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09 -- complete previous step first",
  "error_code": "MISSING_PROOF",
  "retry_count": 1
}
```

**Problem:** The solution was never stored for step 1. The agent was stuck:
it sent the right URI and solution, but the server did not apply it.

## 2. After the fix

With the fix: when the requested step (step 2) has no `proof_of_work`, the
server validates and stores the solution against the **previous** step
(step 1), runs `ensurePreviousProofCompleted` (which now passes), and
returns success. The same request now succeeds.

### Same request (unchanged)

```json
{
  "uri": "kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09",
  "solution": {
    "type": "user_input",
    "user_input": { "confirmation": "Yes, approved." },
    "nonce": "86e77edabbd060ae513f7196bc43c864",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e"
  }
}
```

### Response (success; next_action to kairos_attest)

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09",
    "content": "Only reachable after Step 1 is solved. Show the output from Step 1 to the user.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "comment",
    "description": "Provide a verification comment describing how you completed this step. Write a genuine summary; do not paste unrelated text.",
    "proof_hash": "<hash of stored step1 proof>",
    "nonce": "<new nonce if any>"
  },
  "message": "Protocol steps complete. Call kairos_attest to finalize.",
  "next_action": "call kairos_attest with kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09 and outcome (success or failure) and message to complete the protocol",
  "proof_hash": "<hash of the proof just stored for step 1>"
}
```

**Result:** Step 1's proof is stored. The agent calls
`kairos_attest(uri, outcome, message)` to finish the run.

## Summary

| Scenario | Request | Response |
|----------|---------|----------|
| Original bug | uri=step2, solution=step1 | MISSING_PROOF, retry same URI |
| After fix | uri=step2, solution=step1 | Success, next_action → kairos_attest |

## See also

- [Agent recovery UX](agent-recovery-ux.md) — design principles for
  MISSING_PROOF messages
- [kairos_next workflow](workflow-kairos-next.md) — full error code list
  and recovery paths
- [kairos_attest workflow](workflow-kairos-attest.md)
