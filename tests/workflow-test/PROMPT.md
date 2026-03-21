# Workflow test prompt — MCP-only, reports/ output

Use this prompt when running dev/qa workflow tests so the agent is constrained to MCP tools only and writes all output into `reports/`.

## Constraints (non-negotiable)

- **MCP tools only.** Use only KAIROS MCP tools exposed by the server. The v10 public surface is: **`activate`**, **`forward`**, **`train`**, **`reward`**, **`tune`**, **`export`**, **`delete`**, **`spaces`**. Do not call any other tools (e.g. filesystem, shell, run terminal commands, read/write arbitrary files).
- **No local filesystem access.** Do not read or write files outside the one exception below.
- **No shell or terminal.** Do not execute shell commands, scripts, or CLI invocations.
- **Exception: `reports/` folder.** You may (and must) write **only** under the workspace `reports/` directory. All run output must go there: a main report plus one file per MCP call/request in a subfolder (see Report format below).

## Report format

For each workflow test run:

1. **Run directory:** Create a timestamped or run-id directory under `reports/`, e.g. `reports/<run-id>/`. Use a single run-id for the whole session (e.g. `workflow-YYYY-MM-DD-HHmmss` or an id you generate).

2. **Main report:** Write a single summary report at `reports/<run-id>/report.md` containing:
   - Run id and environment (dev/qa).
   - Scenario results: which scenarios were run (imports; activate + run; update layer; update adapter) and pass/fail or outcome.
   - Short summary of any errors or observations.
   - Do not embed full raw request/response bodies in the main report; reference the per-call files instead.

3. **Per-call files:** For each MCP tool call (request), write one file under `reports/<run-id>/calls/`:
   - Filename pattern: `<nnn>-<tool_name>.json` (e.g. `001-train.json`, `002-activate.json`).
   - Content: JSON object with at least `request` and `response` (full raw call and response so the run is reproducible and debuggable). Example shape:
     ```json
     {
       "request": { "tool": "train", "arguments": { } },
       "response": { }
     }
     ```
   - Number calls sequentially (001, 002, …). If a tool is called multiple times, use distinct numbers (e.g. `003-forward.json`, `004-forward.json`).

## Workflow test scenarios

Execute these in order and record results in the main report:

1. **Imports** — Train adapters from the canonical examples (e.g. content from `docs/examples/`). Use MCP-friendly examples if shell is forbidden. Call **`train`** for each; expect `status: stored` (or equivalent).
2. **Activate + run** — Call **`activate`** with a query that should match a stored adapter; pick one choice; **`forward`** with the returned **adapter** URI and no `solution` to start; then **`forward`** in a loop with `solution` until `next_action` directs **`reward`**; call **`reward`** on the final **layer** URI. Prefer examples without shell if constraints forbid it.
3. **Update layer** — Resolve one layer URI (e.g. via **activate** → **forward** or a known URI). **`export`** that target; edit the returned markdown; **`tune`** with `uris` and `markdown_doc` aligned to the update API. Confirm success.
4. **Update adapter** — Resolve an adapter or head layer. **`export`** with `format: markdown` as appropriate; edit; **`tune`** with multiple URIs and matching `markdown_doc` entries if required. Confirm success.

## Where to use this prompt

- **IDE / chat session:** Paste or inject this prompt so the agent sees the constraints and report format.
- **CI / scripts:** Inject this prompt so the agent writes only to `reports/` and uses only MCP tools.
