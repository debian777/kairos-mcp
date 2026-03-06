> **Note:** This document describes a goal-state design decision. As of
> March 2026, MCP client sampling integration is not yet implemented.

# Challenge prompts and policies (goal state)

This document describes how challenge types map to **sampling prompts** in
the target architecture and how **approval mode** (auto vs user) and
**client policy** determine whether the user must approve each LLM call.

## Challenge types and sampling

Current KAIROS challenge types: **shell**, **mcp**, **user_input**,
**comment** (see [../examples/challenge-types.md](../examples/challenge-types.md)).
In the goal state, for steps that use sampling, the server turns each
challenge into a **fixed prompt** so the LLM is told exactly what to do.
The server validates the LLM output instead of the agent submitting a
free-form solution.

| Challenge type | Sampling prompt (conceptual) | Validation |
|----------------|-----------------------------|------------|
| **mcp** | System: "Call MCP tool X with arguments Y. Return JSON: { tool_name, result, success, arguments? }." User: step-specific input. | Parse JSON; check success and required keys. |
| **shell** | Can stay agent-executed (agent runs the command and submits exit_code/stdout) or, if sampling is used: "You are in a sandbox. Run this command and return JSON: { exit_code, stdout, stderr }." | Check exit_code and shape. |
| **user_input** | System: "Show this prompt to the user and return their reply as JSON: { confirmation }." User: the challenge prompt text. | Require non-empty confirmation; treat as user-approval so the client shows the prompt. |
| **comment** | System: "Provide a verification comment (min N chars) summarizing what was done. Return JSON: { text }." User: step description. | `length >= min_length`; optional semantic check. |

The server builds these messages and sends them via
`sampling/createMessage`. Exact wording and schema are
implementation-defined; the principle is **server-defined prompt,
server-side validation**.

## Step semantics → approval mode

| Step kind | approvalMode | Rationale |
|-----------|--------------|-----------|
| Resolve names, find slot, format output | **auto** | Low risk; no side effects on external systems. |
| Create event, send message, confirm payment | **user** | Safety gate; user must see and approve before the action runs. |

In a "Create calendar appointment" protocol:

- Steps 1–3 (resolve_participants, confirm_duration, find_slot): **auto**
  — the client can run sampling without showing the prompt (when policy
  allows).
- Step 4 (create_event): **user** — the client must show the prompt and
  get user approval before running the LLM.

The server includes `approvalMode` in the sampling request (or omits it
for the default). The client has final say via policy.

## Client policy: allowAutoSampling

The **client** decides whether to run sampling without user approval. A
typical policy:

- **allowAutoSampling:** List of server names for which the client may
  run sampling with `approvalMode: "auto"` without showing the prompt.
  Example: `["kairos-mcp"]`.
- When the server is not in the list, the client always shows the prompt
  (or rejects auto).
- When the server is in the list, the client honors `approvalMode: "auto"`
  for that server's sampling requests.

This keeps the user in control: they explicitly allow kairos-mcp to run
most steps in the background, while still requiring approval for steps
the server marks as user-approved.

## Example: resolve_participants prompt

For a step "resolve_participants" (call MCP-Calendar or similar to
resolve display names to identities):

- **System message:** "You are solving a KAIROS challenge. Call the MCP
  tool find_user_by_name (or equivalent) for each name. Return a single
  JSON object: { \"resolved\": { \"DisplayName\": \"email_or_null\" } }.
  Use null for names you cannot resolve."
- **User message:** "Resolve: Adam, Betty, Candy."
- **Temperature:** 0.2 (deterministic).
- **approvalMode:** auto (no side effects).

The server validates: parse JSON, check `resolved` is an object, then
advances and stores the resolved map for the next step.

## Example: create_event prompt (user approval)

For the final "create_event" step:

- **System message:** "You are solving a KAIROS challenge. Call the MCP
  tool create_event with the provided participants and slot. Return JSON:
  { \"success\": true, \"event_id\": \"...\" } or { \"success\": false,
  \"error\": \"...\" }."
- **User message:** "Create event. Participants: ... Slot: ..."
- **approvalMode:** user — the client must show the prompt and get user
  approval before running.

The server validates `success` and `event_id` (or `error`), then advances
to "complete" and returns `next_action`: call `kairos_attest`.

## Summary

- Challenge types (mcp, shell, user_input, comment) map to **server-built
  sampling prompts** and **server-side validation** of LLM output.
- `approvalMode` is per request: **auto** for low-risk steps, **user**
  for safety-sensitive steps.
- **Client policy** (for example, `allowAutoSampling: ["kairos-mcp"]`)
  determines whether the client runs auto steps without user approval.

## See also

- [01-target-architecture.md](01-target-architecture.md)
- [02-workflow-sampling.md](02-workflow-sampling.md) — sampling sequence
  and approval modes
