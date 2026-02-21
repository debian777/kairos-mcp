# Workflow test prompt — MCP-only, reports/ output

Use this prompt when running dev/qa workflow tests so the agent is constrained to MCP tools only and writes all output into `reports/`.

## Constraints (non-negotiable)

- **MCP tools only.** Use only KAIROS MCP tools: `kairos_search`, `kairos_begin`, `kairos_next`, `kairos_mint`, `kairos_dump`, `kairos_update`, `kairos_attest`, `kairos_delete` (and any other MCP tools exposed by the KAIROS server). Do not call any other tools (e.g. filesystem, shell, run terminal commands, read/write arbitrary files).
- **No local filesystem access.** Do not read or write files outside the one exception below.
- **No shell or terminal.** Do not execute shell commands, scripts, or CLI invocations.
- **Exception: `reports/` folder.** You may (and must) write **only** under the workspace `reports/` directory. All run output must go there: a main report plus one file per MCP call/request in a subfolder (see Report format below).

## Report format

For each workflow test run:

1. **Run directory:** Create a timestamped or run-id directory under `reports/`, e.g. `reports/<run-id>/`. Use a single run-id for the whole session (e.g. `workflow-YYYY-MM-DD-HHmmss` or an id you generate).

2. **Main report:** Write a single summary report at `reports/<run-id>/report.md` containing:
   - Run id and environment (dev/qa).
   - Scenario results: which scenarios were run (imports; search + workflows; update step; update chain) and pass/fail or outcome.
   - Short summary of any errors or observations.
   - Do not embed full raw request/response bodies in the main report; reference the per-call files instead.

3. **Per-call files:** For each MCP tool call (request), write one file under `reports/<run-id>/calls/`:
   - Filename pattern: `<nnn>-<tool_name>.json` (e.g. `001-kairos_mint.json`, `002-kairos_search.json`).
   - Content: JSON object with at least `request` and `response` (full raw call and response so the run is reproducible and debuggable). Example shape:
     ```json
     {
       "request": { "tool": "kairos_mint", "arguments": { ... } },
       "response": { ... }
     }
     ```
   - Number calls sequentially (001, 002, …). If a tool is called multiple times, use distinct numbers (e.g. 003-kairos_next.json, 004-kairos_next.json).

## Workflow test scenarios

Execute these in order and record results in the main report:

1. **Imports** — Mint protocols from the canonical examples (e.g. content from `docs/examples/`). Use only MCP-only examples if the run forbids shell (protocol-example-mcp, protocol-example-comment, protocol-example-user-input). Call `kairos_mint` for each; expect `status: stored` or equivalent.
2. **Search + workflows** — Run `kairos_search` with a query that should match the minted chains; pick a chain; call `kairos_begin` with its URI; then call `kairos_next` in a loop until `next_action` indicates run complete. Use protocols that do not require shell (MCP-only) if constraints forbid shell.
3. **Update step** — Resolve one step (e.g. via search → begin or existing URI). Call `kairos_dump` for that step URI; edit the returned `markdown_doc`; call `kairos_update` with `uris: [uri]` and `markdown_doc: [edited_doc]`. Confirm success.
4. **Update chain** — Resolve a full chain (e.g. head URI). Call `kairos_dump` with `protocol: true` for the chain; edit the markdown; call `kairos_update` with multiple URIs and corresponding `markdown_doc` array. Confirm success.

## Where to use this prompt

- **Cursor / IDE:** When running workflow tests from this repo, include this prompt (or the rule in `.cursor/rules/workflow-test-mcp-only.mdc`) so the agent sees the constraints and report format.
- **CI / scripts:** When driving an AI agent for workflow tests, inject this prompt so the agent writes only to `reports/` and uses only MCP tools.
