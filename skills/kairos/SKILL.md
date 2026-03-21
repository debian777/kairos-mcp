---
name: kairos
description: >-
  KAIROS workflow engine. Use when the user's message describes an
  action, task, workflow, or procedure. Also use when the user invokes
  /kairos. Do not require the user to mention tools or protocols. For
  first-time install and server setup, use the kairos-install skill instead.
metadata:
  version: "3.4.0"
  author: kairos-mcp
allowed-tools: activate forward train reward tune delete export spaces
---

# kairos

Call **`activate`** with the user's message (or a concise intent phrase).
Follow the returned choice's `next_action` exactly (usually **`forward`**
with an adapter URI, then layer URIs until **`reward`**).
Complete **`reward`** when `next_action` directs you to, before responding
to the user.

The tool descriptions for **`activate`**, **`forward`**, and **`reward`**
(and helpers **`train`**, **`tune`**, **`export`**, **`delete`**,
**`spaces`**) contain all execution rules. Read them; they are authoritative.
