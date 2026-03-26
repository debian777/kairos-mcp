---
name: kairos
description: >-
  KAIROS workflow engine. Use when the user's message describes an
  action, task, workflow, or procedure. Also use when the user invokes
  /kairos. Treat /k as likely shorthand for /kairos when the surrounding
  intent is clearly about KAIROS. KAIROS MCP usage is mandatory for
  these requests; do not substitute an ad hoc answer. If KAIROS MCP is
  unavailable, unauthenticated, or disconnected, ask the user to help
  restore auth, connection, or server availability before proceeding.
  For first-time install and server setup, use the kairos-install skill
  instead.
metadata:
  version: "4.0.0-beta.1"
  author: kairos-mcp
allowed-tools: activate forward train reward tune delete export spaces
---

# kairos

You must use KAIROS MCP whenever this skill applies. Do not answer from
general reasoning alone when KAIROS MCP should be used.

If KAIROS MCP is unavailable, unauthenticated, or disconnected, stop,
state what is missing, and ask the user to help remedy auth,
connection, or server availability before proceeding.

Call **`activate`** with the user's message (or a concise intent phrase).
Follow the returned choice's `next_action` exactly (usually **`forward`**
with an adapter URI, then layer URIs until **`reward`**).
Complete **`reward`** when `next_action` directs you to, before responding
to the user.

The tool descriptions for **`activate`**, **`forward`**, and **`reward`**
(and helpers **`train`**, **`tune`**, **`export`**, **`delete`**,
**`spaces`**) contain all execution rules. Read them before calling the
tools; they are authoritative.
