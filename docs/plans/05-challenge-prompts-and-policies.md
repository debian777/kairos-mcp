# Challenge prompts and policies (goal state)

This document describes how challenge types (and step semantics) map to **sampling prompts** in the target architecture, and how **approval mode** (auto vs user) and **client policy** determine whether the user must approve each LLM call.

---

## Challenge types and sampling

Today KAIROS has challenge types: **shell**, **mcp**, **user_input**, **comment** (see [../examples/challenge-types.md](../examples/challenge-types.md)). In the goal state, for steps that use **sampling**, the server turns the challenge into a **fixed prompt** so the LLM is told exactly what to do (e.g. which tool to call, what shape to return). The server then validates the LLM output instead of the agent submitting a free-form solution.

| Challenge type | Sampling prompt (conceptual) | Validation |
|----------------|-----------------------------|------------|
| **mcp** | System: “Call MCP tool X with arguments Y. Return JSON: { tool_name, result, success, arguments? }.” User: step-specific input (e.g. “Resolve: Adam, Betty, Candy”). | Parse JSON; check success and required keys. |
| **shell** | Can stay agent-executed (agent runs the command and submits exit_code/stdout) or, if sampling is used, system: “You are in a sandbox. Run this command and return JSON: { exit_code, stdout, stderr }.” | Check exit_code and shape. |
| **user_input** | System: “Show this prompt to the user and return their reply as JSON: { confirmation }.” User: the challenge prompt text. | Require non-empty confirmation; optionally treat as “user must approve” so the client shows the prompt. |
| **comment** | System: “Provide a verification comment (min N chars) summarizing what was done. Return JSON: { text }.” User: step description. | length ≥ min_length; optional semantic check. |

The server builds these messages and sends them via `sampling/createMessage`. Exact wording and schema are implementation-defined; the principle is **server-defined prompt, server-side validation**.

---

## Step semantics → approval mode

Not every step should run without user attention. The server (or protocol author) can tag steps with an **approval mode**:

| Step kind | approvalMode | Rationale |
|-----------|--------------|-----------|
| Resolve names, find slot, format output | **auto** | Low risk; no side effects on external systems. |
| Create event, send message, confirm payment | **user** | Safety gate; user must see and approve before the action. |

So in a “Create calendar appointment” protocol:

- Steps 1–3 (resolve_participants, confirm_duration, find_slot): **auto** — client can run sampling without showing the prompt (if policy allows).
- Step 4 (create_event): **user** — client must show the prompt and get user approval before running the LLM.

The server includes `approvalMode` in the sampling request (or a default when omitted). The client still has final say via policy.

---

## Client policy: allowAutoSampling

The **client** decides whether to run sampling without user approval. A typical policy:

- **allowAutoSampling:** List of server names (or identifiers) for which the client may run sampling with `approvalMode: "auto"` without showing the prompt. Example: `["kairos-mcp"]`.
- If the server is not in the list, the client always shows the prompt to the user (or rejects auto).
- If the server is in the list, the client honours `approvalMode: "auto"` for that server’s sampling requests.

This keeps the user in control: they explicitly allow kairos-mcp (or other trusted servers) to run most steps in the background, while still requiring approval for steps the server marks as user-approved.

---

## Example: resolve_participants prompt

For a step “resolve_participants” (semantically: call MCP-Calendar or similar to resolve display names to identities):

- **System message:** “You are solving a KAIROS challenge. Call the MCP tool find_user_by_name (or equivalent) for each name. Return a single JSON object: { \"resolved\": { \"DisplayName\": \"email_or_null\" } }. Use null for names you cannot resolve.”
- **User message:** “Resolve: Adam, Betty, Candy.”
- **Temperature:** 0.2 (deterministic).
- **approvalMode:** auto (step has no side effects).

Server validates: parse JSON, check `resolved` is an object, then advances and (e.g.) passes the resolved map to the next step or stores it in session handover.

---

## Example: create_event prompt (user approval)

For the final “create_event” step:

- **System message:** “You are solving a KAIROS challenge. Call the MCP tool create_event with the provided participants and slot. Return JSON: { \"success\": true, \"event_id\": \"...\" } or { \"success\": false, \"error\": \"...\" }.”
- **User message:** “Create event. Participants: ... Slot: ...”
- **approvalMode:** user — client must show this prompt and get user approval before running.

Server validates success and event_id (or error), then advances to “complete” and returns next_action: kairos_attest.

---

## Summary

- **Challenge types** (mcp, shell, user_input, comment) map to **server-built sampling prompts** and **server-side validation** of LLM output.
- **approvalMode** is per request: **auto** for low-risk steps, **user** for safety-sensitive steps.
- **Client policy** (e.g. allowAutoSampling: ["kairos-mcp"]) determines whether the client will actually run auto steps without user approval.
