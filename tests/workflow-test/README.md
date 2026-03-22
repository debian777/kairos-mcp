# Workflow tests (dev)

This directory defines **agent-driven workflow tests** for KAIROS: an AI agent runs scenarios using **only MCP tools**, with no shell or filesystem access except writing to `reports/`. The canonical protocol examples live in [docs/examples/](../../docs/examples/).

**Canonical agent instructions** (prompt and constraints) are in [PROMPT.md](PROMPT.md).

## Purpose

- **Imports:** Mint protocols from `docs/examples/` via `kairos_mint`.
- **Search + workflows:** Execute search → begin → next (loop) until the flow directs you to `kairos_attest`, then attest.
- **Update step:** Dump one step, edit, then `kairos_update` (single step).
- **Update chain:** Dump full chain, edit, then `kairos_update` (multiple steps).

All tool calls and outcomes must be recorded under `reports/` so runs are reproducible and auditable.

## Prompt and constraints

Use the prompt in [PROMPT.md](PROMPT.md) when running these tests. It enforces:

- **MCP tools only** (no filesystem, no shell).
- **Exception:** write only under `reports/`.
- **Report layout:** `reports/<run-id>/report.md` (summary) and `reports/<run-id>/calls/<nnn>-<tool>.json` (one file per request with full raw request/response).

If you run these tests in an IDE chat, paste the contents of [PROMPT.md](PROMPT.md)
directly into the session or otherwise enforce the same constraints manually.

## How to run

1. **Deploy dev server** so MCP is available:
   ```bash
   npm run dev:deploy
   ```
2. **Start a session** with the workflow-test prompt active (for example, paste [PROMPT.md](PROMPT.md) into the chat or inject it through your automation harness).
3. **Ask the agent** to run the four scenarios (imports; search + workflows; update step; update chain). The agent must use only KAIROS MCP tools and write all output to `reports/<run-id>/`.
4. **Inspect results:** Check `reports/<run-id>/report.md` and `reports/<run-id>/calls/*.json` for pass/fail and raw calls.

## Automated import test

The **imports** scenario is also covered by an integration test that mints each mintable file from `docs/examples/` via the MCP client (no agent). Run it after deploy:

```bash
npm run dev:deploy && npm run dev:test -- tests/integration/kairos-mint-docs-examples.test.ts
```

See [kairos-mint-docs-examples.test.ts](../integration/kairos-mint-docs-examples.test.ts).

## Report structure (reference)

```
reports/
  <run-id>/
    report.md          # Summary: scenarios, pass/fail, brief notes
    calls/
      001-kairos_mint.json
      002-kairos_search.json
      003-kairos_begin.json
      004-kairos_next.json
      ...
```

Each `calls/*.json` file should contain at least `request` and `response` (full bodies) for that single MCP call.
