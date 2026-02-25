---
name: Sampling for user_input implementation
overview: "Implementation plan to replace agent-driven user_input proof submission with a server-driven driver (prefer elicitation, optionally sampling as a compatibility path) so the server can obtain, validate, store, and advance user_input steps without relying on the agent."
todos: []
isProject: false
---

# Implementation plan: server-driven user_input (elicitation + sampling fallback)

## Objective

This plan replaces **agent-driven** `user_input` proof submission with a
**server-driven** flow that requests the confirmation from the connected MCP
client, validates it, stores it as proof-of-work, and advances the protocol.

This change is incremental and backwards compatible. If the client does not
support the required capability, the server falls back to the current behavior
where the agent obtains the user reply and submits `solution.user_input`.

This plan aligns with the goal state in `docs/plans/` where the server is the
director: it defines prompts, requests execution via the client, and validates
outputs before advancing.

## Non-goals

This plan does not implement generic sampling for `shell`, `mcp`, or `comment`
steps. It only targets `user_input` steps because they are the highest-friction
step type for agents.

This plan does not remove support for existing `elicitInput` behavior. It keeps
elicitation as a safe fallback (and, depending on the client, the preferred
mechanism for obtaining true user-entered input).

## Current behaviour (to replace or extend)

Today, `user_input` is primarily agent-driven:

- `user_input` proof definition lives in `src/types/memory.ts` as
  `ProofOfWorkDefinition.user_input.prompt`.
- The challenge returned to the agent is built in
  `src/tools/kairos_next-pow-helpers.ts` via `buildChallengeShapeForDisplay()`.
- `kairos_next` enforces that a `solution` exists for steps 2+, then (only for
  `user_input` steps where `solution.user_input.confirmation` is missing) tries
  server-side elicitation via `tryUserInputElicitation()`:
  - It checks client capabilities with `server.server.getClientCapabilities()`.
  - If supported, it calls `server.server.elicitInput({ message, requestedSchema })`.
  - If accepted, it injects the returned confirmation into the solution.
- Proof validation and storage happen in `handleProofSubmission()` which rejects
  missing `user_input.confirmation` and persists `{ confirmation, timestamp }`.

The net effect is: without elicitation support, the agent must show the prompt
to the user and submit the user's reply as `solution.user_input.confirmation`.

## Target behaviour

When the current step requires `proof_of_work.type === "user_input"` and the
incoming `solution.user_input.confirmation` is missing, the server obtains and
validates the confirmation itself.

### Decision tree (server-side)

The server uses the following decision tree for `user_input`:

1. **If confirmation is already present**, validate and store it as today.
2. **If confirmation is missing and the feature flag is enabled**:
   - Prefer **elicitation** when available because it is the only mechanism
     that reliably obtains true user-entered data.
   - Otherwise try **sampling** (client capability: sampling) if configured.
     The server requests sampling in a way that requires user approval. If the
     SDK and client support an explicit approval mode field, set it to `"user"`.
3. **If neither capability is available**, fall back to agent-driven behavior:
   return the normal challenge and next_action so the agent can ask the user
   and resubmit.

### Validation

To avoid introducing ambiguity, apply stricter validation only when the server
obtains the confirmation via elicitation or sampling. Keep the legacy
agent-submitted path unchanged unless you intentionally tighten it.

- For server-driven confirmations, accept only `"approved"` or `"rejected"` and
  reject empty values.
- If sampling is used, reject non-JSON responses or extra keys when the request
  requires strict JSON.
- For agent-submitted confirmations, the current code only requires a non-empty
  string. Tightening that behavior is a separate compatibility decision.

### Approval mode

For any sampling-based attempt, the server requests user approval. If the SDK
supports `approvalMode`, set it to `"user"`. This plan does not introduce any
`auto` mode for `user_input`.

> **Warning:** Sampling is an LLM completion mechanism. It only approximates
> "user input" if the client UX requires user approval and the client does not
> allow the model to invent user responses. Treat this as a compatibility path,
> not a security boundary. Prefer elicitation when supported.

## Implementation steps

### 1. Add configuration flags

Introduce explicit config so rollout is safe and reversible:

- `KAIROS_USER_INPUT_DRIVER`:
  - `"elicitation"` (default)
  - `"sampling"`
  - `"agent"` (force legacy behavior)
- `KAIROS_ENABLE_USER_INPUT_SERVER_DRIVER` (boolean, default false) to gate the
  entire feature.

The plan assumes these flags live in `src/config.ts` alongside the rest of the
runtime config.

### 2. Implement server-side sampling for `user_input` as a helper

Add a helper that mirrors the existing elicitation helper:

- **Location**: `src/tools/kairos_next-pow-helpers.ts` (or a small dedicated
  module under `src/services/` if the file nears the 350-line limit).
- **Name**: `tryUserInputSampling(...)` following the shape of
  `tryUserInputElicitation(...)`.
- **Trigger**: `memory.proof_of_work.type === "user_input"` and
  `solution.user_input.confirmation` is missing.
- **Capability detection**:
  - Read client caps via `server.server.getClientCapabilities?.()`.
  - Require `caps?.sampling != null`.
  - Require `typeof server.server.createMessage === "function"`.
- **Invocation**: call `server.server.createMessage({ ... })` as documented by
  the MCP TypeScript SDK (`@modelcontextprotocol/sdk`).

The request uses fixed messages. The system message instructs the client to
obtain a user reply and return strict JSON:

- System content: "Show the following prompt to the user. Return only JSON:
  { \"confirmation\": \"approved\" | \"rejected\" }."
- User content: the step prompt from
  `memory.proof_of_work.user_input.prompt` (or a default).

### 3. Integrate the helper into `kairos_next`

Update `src/tools/kairos_next.ts` in the same place where it currently calls
`tryUserInputElicitation()`:

- If the feature is disabled, keep the existing behavior unchanged.
- If enabled:
  - Run `tryUserInputSampling()` first when driver is `"sampling"`.
  - Run `tryUserInputElicitation()` first when driver is `"elicitation"`.
  - Always keep the other mechanism as a fallback when the primary driver is
    unavailable or fails (for example capability missing, declined, or invalid
    output).

This keeps behavior stable across heterogeneous clients.

### 4. Preserve backward compatibility in the public API

Avoid requiring new tools or a changed call pattern:

- `kairos_next` still requires `solution` for steps 2+. The agent can keep
  sending a placeholder object such as `{ type: "user_input" }` and let the
  server fill in the confirmation when possible.
- When the server cannot obtain the confirmation itself, it returns the
  existing `user_input` challenge and `next_action` instructing the agent to
  ask the user and retry.

If you want to support "call kairos_next without a solution for user_input
steps", handle that as a separate change because it affects schema, error
handling, and backward compatibility.

### 5. Add tests

Add tests that prove behavior is correct and remains compatible:

- **Unit tests** for the new helper:
  - Sampling capability missing returns `{ solution }` unchanged.
  - Sampling returns invalid output returns an error payload (no advance).
  - Sampling returns `{ confirmation: "approved" }` injects the confirmation
    with a server-generated timestamp.
- **Integration tests** for `kairos_next`:
  - `user_input` step with placeholder solution triggers server-side driver when
    enabled and the mocked client supports it.
  - Decline paths return `USER_DECLINED` and do not record proof.

### 6. Add metrics and logging

Add minimal, high-signal telemetry so you can safely roll out:

- Counts for `user_input` driver selection (sampling vs elicitation vs agent).
- Counts for sampling failures by error code.
- Duration for sampling/elicitation calls.

Use the existing structured logger and Prometheus metrics patterns in `src/`.

### 7. Rollout plan

Roll out gradually:

1. Merge behind `KAIROS_ENABLE_USER_INPUT_SERVER_DRIVER=false`.
2. Enable in dev only, validate with `npm run dev:deploy && npm run dev:test`.
3. Enable in qa, validate with `npm run qa:deploy && npm run qa:test`.
4. Promote to prod only after validating both capability paths and the fallback
   behavior with at least one client that lacks sampling or elicitation.

## Open questions

These questions affect correctness and safety. Answer them before implementing
the sampling path for `user_input`:

1. Do you want `user_input` to continue to mean "user-entered input" (then
   elicitation is the preferred driver), or is it acceptable for some clients
   to satisfy it via sampling with user approval?
2. Do you want to keep the `"approved" | "rejected"` enum, or accept arbitrary
   confirmation strings?
3. Which MCP clients do you target first (Cursor, Claude Desktop, others), and
   which of them support `elicitation` and/or `sampling` today?

