---
name: kairos
description: >-
  Run KAIROS protocols. Use when the user's message describes an action,
  task, or workflow, or when they invoke /k, /apply, or /search. Do not
  require them to mention KAIROS or tools. For first-time install and server
  setup, use the kairos-install skill instead.
---

# kairos

**Protocol execution only.** For installing KAIROS (minimal Docker + .env and MCP config), use the **kairos-install** skill.

When the user wants to run a protocol (natural-language intent, or after /k, /apply, /search):

1. Call **`kairos_run(message)`** with the user's message — or with everything after `/k`, `/apply`, or `/search`. The server searches and begins the best match or the refine protocol.
2. Follow the returned `next_action` exactly: run the challenge, then `kairos_next` (loop until `next_action` directs to `kairos_attest`), then `kairos_attest`. Echo nonces and proof hashes from the server; never compute them yourself.

For manual search (e.g. from a protocol-specific skill), use `kairos_search(query)` then `kairos_begin(uri)` with the chosen URI. Tool descriptions for `kairos_run`, `kairos_begin`, `kairos_next`, and `kairos_attest` are authoritative.
