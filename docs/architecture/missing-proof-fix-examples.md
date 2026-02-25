# MISSING_PROOF fix: JSON examples

Two-step protocol (step 1 = user_input "Confirm deployment", step 2 = last step, no challenge). Agent follows `next_action` and calls **kairos_next(uri=step2, solution=step1_solution)**.

## Agreed decisions

- **MISSING_PROOF fix:** Bug confirmed; fix implemented. When the agent calls `kairos_next(uri=step_with_no_proof, solution=for_previous_step)`, the server validates and stores the solution against the **previous** step, then continues (ensurePreviousProofCompleted passes; quality uses the completed previous step). Same behavior for MCP and HTTP API. Code: `src/tools/kairos_next.ts`, `src/http/http-api-next.ts`; helpers: `handleProofSubmission`, `ensurePreviousProofCompleted`, `resolveChainPreviousStep`, `loadMemoryWithCache`.
- **kairos_attest as last step:** Agreed design (MCP/agent UX). When there are no more content steps, `next_action` always directs the agent to **call kairos_attest** (no "Run complete." with no tool call). Rationale: deterministic completion (single pattern: "call kairos_attest" vs ambiguous "Run complete"), explicit outcome and message, simpler `must_obey` handling. This is the chosen pattern for agent-facing completion.

---

## Sample kairos_begin

Agent starts the protocol with the chain head URI (from search or mint). Step 1 has a user_input challenge; `next_action` tells the agent to call kairos_next with **step 2’s URI** and a solution matching the challenge.

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

The agent then performs the challenge (gets user confirmation), and calls **kairos_next** with `uri: "kairos://mem/cd24bae8-474e-40c0-b3a1-ab1c51cc8a09"` (step 2) and the solution for step 1 (user_input + nonce + proof_hash from above). The sections below show what happens when that kairos_next call is made.

---

## 1. Current problem

Agent calls kairos_next with the **next** step URI (step 2) and the solution for **step 1**. Server loads step 2 (no `proof_of_work`), does not apply the solution to step 1, then runs ensurePreviousProofCompleted → step 1 has no stored result → **MISSING_PROOF**.

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

**Problem:** Solution was never stored for step 1. Agent is stuck: it sent the right URI and solution, but the server did not apply it.

---

## 2. Status after re-adding kairos_attest

We restored kairos_attest as the last step. So when there are no more content steps, `next_action` always directs to **call kairos_attest** (no more "Run complete." with no next action). The **MISSING_PROOF bug is unchanged**: the same request still gets the same error response. We still do not apply the solution to the previous step when the requested step has no proof_of_work.

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

### Response (still MISSING_PROOF)

Same as in section 1. Error shape and message are the same; only the default challenge for the “no proof” step might show a comment-type challenge. No next_action to attest yet, because we never reach the success path.

---

## 3. After the fix

With the "apply solution to previous step" fix: when the requested step (step 2) has no `proof_of_work`, we validate and store the solution against the **previous** step (step 1), then run ensurePreviousProofCompleted (it passes), and return success. So the same request now succeeds and returns a proper next_action (to kairos_attest).

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

**Result:** Step 1’s proof is stored. Agent can now call **kairos_attest(uri, outcome, message)** to finish the run. No MISSING_PROOF; every step has a clear next_action (next kairos_next or kairos_attest).

---

## Summary

| Scenario              | Request                          | Response                                      |
|-----------------------|-----------------------------------|-----------------------------------------------|
| Current problem       | uri=step2, solution=step1         | MISSING_PROOF, retry same URI                 |
| After attest restored | uri=step2, solution=step1         | Same MISSING_PROOF (bug unchanged)            |
| After fix             | uri=step2, solution=step1         | Success, next_action → kairos_attest          |

The fix and kairos_attest-as-last-step design above are agreed; see **Agreed decisions** at the top of this document.
