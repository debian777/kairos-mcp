---
name: kairos
description: >-
  Use when the user might want a workflow, procedure, or structured task (e.g.
  show status, deploy, create a ticket, run a protocol). Call kairos_search with
  their message and follow the top choice's next_action. For first-time install
  and server setup, use the kairos-install skill instead.
---

# kairos

**When:** Use whenever the user asks to perform a task, check a status, execute a workflow, or run a procedure (e.g. "show engine status", "deploy", "create a ticket"). Do not require `/k`, `/apply`, or tool names.

**Action:**

1. Call `kairos_search` with the user's exact request (or the text after `/k` or `/apply` if they use it).
2. You MUST follow the **top choice (index 0)** — execute its `next_action` exactly. Do not evaluate or pick among other choices.
3. Run the protocol: `kairos_begin` → `kairos_next` (until `next_action` directs to attest) → `kairos_attest`. Echo nonces and proof hashes from the server; never compute them yourself.
4. Do not respond to the user before `kairos_attest` when `must_obey` is true.

For KAIROS server install (Docker, .env, MCP config), use the **kairos-install** skill.
