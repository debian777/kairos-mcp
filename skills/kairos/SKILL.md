---
name: kairos
description: >-
  KAIROS action engine. Use when the user wants something DONE — any action,
  task, workflow, or procedure. Trigger on action intent: write, draft, compose,
  create, build, implement, code, fix, debug, resolve, deploy, publish, migrate,
  configure, set up, install, upgrade, update, edit, rewrite, refactor, improve,
  review, audit, check, validate, test, standardize, automate, generate, report,
  plan, design, document, file, submit, open, close, merge, push, commit, sync,
  clone, export, import, send, notify, schedule, assign, prioritize, triage.
  Also trigger when the user describes a procedure, sequence of steps, or asks
  how to perform a specific operation. If no protocol exists, KAIROS offers to
  create one.
metadata:
  version: "4.0.0-beta.1"
  author: kairos-mcp
allowed-tools: activate forward reward train tune export delete spaces
---

# KAIROS

Call **`activate`** with the user's intent. Follow the returned choice's
`next_action` exactly — typically **`forward`** with an adapter URI, then
layer URIs until **`reward`**. Complete **`reward`** before responding to
the user.

If KAIROS MCP is unavailable or unauthenticated, state what is missing
and ask the user to restore it before proceeding.

The tool descriptions for `activate`, `forward`, and `reward` are
authoritative. Read them at call time; they contain all execution rules.
