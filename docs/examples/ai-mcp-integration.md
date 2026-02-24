# AI–MCP integration: run protocols on KAIROS (kairos-dev)

Use this when an AI agent should run protocols on **kairos-dev**: import protocols from this folder one by one, then search and follow each workflow to completion. The goal is to run **protocols** (their steps and challenges), not to exercise MCP tools in isolation.

## How to run

1. **Use kairos-dev**  
   Call only the KAIROS MCP tools exposed by the **kairos-dev** server (`kairos_search`, `kairos_begin`, `kairos_next`, `kairos_mint`, `kairos_dump`, `kairos_update`, `kairos_delete`, etc.).

2. **Import protocols one by one**  
   For each mintable file in `docs/examples/` (e.g. `protocol-example-mcp.md`, `protocol-example-comment.md`, `protocol-example-user-input.md`, `protocol-example-shell.md`, `protocol-example-all-types.md`), read the file and call `kairos_mint` with its full markdown and an `llm_model_id`. Treat each import as a real run: one protocol per file, in order.

3. **Search and follow the workflow**  
   After importing (or when a protocol is already present), run a real workflow:
   - Call `kairos_search` with a query that matches the protocol you want.
   - Pick one chain from the results and call `kairos_begin` with its URI.
   - If the response gives a `next_action` that tells you to call `kairos_next` with a URI, complete the step’s challenge and call `kairos_next` with that URI and the correct solution; repeat until the run is complete.
   - Treat this as **real execution**: do what each step requires (e.g. run the requested MCP tool, provide the comment or user confirmation, or shell command result) and advance through the protocol.

## Reports

- **One report per protocol file.** For each `docs/examples/protocol-example-*.md` that was imported or run, write a single report under `reports/<run-id>/<protocol-folder>/report.md` (e.g. `reports/workflow-YYYY-MM-DD-HHmmss/protocol-example-all-types/report.md`).
- **Flow in each report:** Import → Search → Begin → Next (if applicable). For each step: **what you did** and **why** (UX), then the full **request/response JSON** in a markdown code block. Use **pretty-printed JSON** (indented, human-readable). Do not use separate JSON files or includes; put all call/response data inline in the report.
- **Always regenerate reports.** Do not edit existing reports; (re)generate each report in full when writing.

## Why one-by-one

Protocols are the unit of behavior. Importing and running them one by one ensures each protocol is executed as intended and makes it clear which chain and which step succeeded or failed. Running in batch or only “testing tools” would not validate the protocols themselves.

## Reference

- **Mintable files:** See [README](README.md) in this folder for the list of protocol files and their challenge types.
- **Challenge types and solution shapes:** [challenge-types.md](challenge-types.md).
