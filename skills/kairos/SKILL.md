---
name: kairos
description: >-
  KAIROS workflow engine. Use when the user's message describes an
  action, task, workflow, or procedure. Also use when the user invokes
  /kairos. Do not require the user to mention tools or protocols. For
  first-time install and server setup, use the kairos-install skill instead.
metadata:
  version: "3.3.3"
  author: kairos-mcp
allowed-tools: kairos_search kairos_begin kairos_next kairos_mint kairos_attest kairos_dump kairos_update kairos_delete kairos_spaces
---

# kairos

Call `kairos_search` with the user's message (or a concise intent phrase).
Follow the returned choice's `next_action` exactly.
Complete `kairos_attest` before responding to the user.

The tool descriptions for `kairos_search`, `kairos_begin`, `kairos_next`,
and `kairos_attest` contain all execution rules. Read them; they are
authoritative.
