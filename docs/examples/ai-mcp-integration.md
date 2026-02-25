# AI–MCP integration: run protocols on KAIROS (kairos-dev)

Use this when an AI agent should run protocols on **kairos-dev** from a **real user perspective**: the agent has only the **KAIROS MCP** (kairos-dev) and limited filesystem access. No shell. Figure out how to use KAIROS from what the MCP exposes (tools, resources). The goal is to run **protocols** end-to-end as a user would, not to exercise tools in isolation.

## Allowed access

- **MCP only:** Use only the KAIROS MCP server **kairos-dev**. No other MCP servers or tools for this test.
- **Filesystem:**  
  - **Read-only:** `docs/examples/` (protocol markdown only). **Blocked:** `docs/examples/README.md` — do not read it.  
  - **Write only:** reports under `reports/<run-id>/<protocol-folder>/report.md`.  
  No other filesystem read or write.
- **No shell:** Do not run any shell commands. Assume kairos-dev is already running.

## What to do

1. **Import protocols one by one**  
   For each mintable file in `docs/examples/`, read the file and import it via the MCP (one protocol per file, in order). Use only what the MCP provides to discover how.

2. **Run a real workflow per protocol**  
   After importing (or when a protocol is already present), run that protocol to completion using the MCP. For steps that would require shell or other non-MCP actions, either skip those protocols in this test or satisfy them only with the means you have (e.g. user input or comment). Do not run shell commands.

## Reports

- **One report per protocol file.** For each `docs/examples/protocol-example-*.md` that was imported or run, write a single report under `reports/<run-id>/<protocol-folder>/report.md` (e.g. `reports/workflow-YYYY-MM-DD-HHmmss/protocol-example-all-types/report.md`). This is the **only** place you write files.
- **Flow in each report:** Import → run workflow. For each step: **what you did** and **why** (UX), then the full **request/response JSON** in a markdown code block. Use **pretty-printed JSON** (indented, human-readable). Put all call/response data inline in the report.
- **Always regenerate reports.** Do not edit existing reports; (re)generate each report in full when writing.

## Why one-by-one

Protocols are the unit of behavior. Importing and running them one by one ensures each protocol is executed as intended and makes it clear which chain and which step succeeded or failed.