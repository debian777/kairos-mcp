# AI–MCP integration: run protocols on KAIROS (kairos-dev)

Run protocols on **kairos-dev** from a real user perspective. The agent
has access only to the **KAIROS MCP** (kairos-dev) and limited
filesystem access. No shell. Use only what the MCP exposes (tools,
resources). The goal is to execute **protocols** end-to-end as a user
would, not to exercise tools in isolation.

## Allowed access

- **MCP only:** Use only the KAIROS MCP server **kairos-dev**. No other
  MCP servers or tools.
- **Filesystem:**
  - **Read-only:** `docs/examples/` (protocol markdown only). **Blocked:**
    `docs/examples/README.md` — do not read it.
  - **Write only:** `reports/<run-id>/<protocol-folder>/report.md`.
    No other filesystem reads or writes.
- **No shell:** Do not run shell commands. Assume kairos-dev is already
  running.

## What to do

1. **Import protocols one by one.**
   For each mintable file in `docs/examples/`, read the file and import
   it via `kairos_mint` (one protocol per file, in order).

2. **Run a complete workflow per protocol.**
   After importing (or when a protocol is already present), run that
   protocol to completion using the MCP. For protocols that contain a
   `shell` challenge: skip those protocols in this test — do not run
   shell commands, and do not fabricate shell results.

## Reports

- **One report per protocol file.** For each
  `docs/examples/protocol-example-*.md` that was imported or run, write
  a single report under
  `reports/<run-id>/<protocol-folder>/report.md` (e.g.
  `reports/workflow-YYYY-MM-DD-HHmmss/protocol-example-all-types/report.md`).
  This is the **only** place you write files.
- **Report format per step:** State what you did and why (UX), then
  include the full request/response JSON in a markdown code block. Use
  pretty-printed JSON (indented). Put all call/response data inline.
- **Regenerate reports in full.** Do not edit existing reports.

## MUST ALWAYS

- Import and run each protocol individually.
- Write one report per protocol file to the designated path.
- Regenerate each report in full when writing.

## MUST NEVER

- Read `docs/examples/README.md`.
- Run shell commands.
- Fabricate shell output — skip protocols with `shell` challenges.
- Write files outside `reports/<run-id>/`.

## Why one by one

Protocols are the unit of behavior. Importing and running them
individually ensures each protocol executes as intended and makes each
chain's success or failure explicit.
