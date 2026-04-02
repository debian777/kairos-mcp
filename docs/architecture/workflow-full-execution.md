# Full execution workflow: activate through reward

End-to-end view of a KAIROS adapter run on the current MCP surface. The
server drives every transition via `next_action` and `must_obey`.

**Authoritative detail:** [`src/embed-docs/tools/activate.md`](../../src/embed-docs/tools/activate.md),
[`forward.md`](../../src/embed-docs/tools/forward.md),
[`reward.md`](../../src/embed-docs/tools/reward.md).

## Tool order (runtime)

1. **`activate`** — semantic match on the user’s intent; returns `choices`
   with `kairos://adapter/{uuid}` (and refine/create paths).
2. **`forward`** — first call with the chosen **adapter** URI and **no**
   `solution` loads the first layer and `contract`. Subsequent calls use the
   **layer** URI from the prior response, with a `solution` whose `type`
   matches `contract.type` (including `tensor`, `shell`, `mcp`,
   `user_input`, `comment`). Echo server **`nonce`** and **`proof_hash`**
   verbatim when the contract requires it.
3. Repeat **`forward`** until `next_action` directs you to **`reward`**.
4. **`reward`** — finalize the run with the **final layer** URI (and
   `execution_id` query param when the run used it), `outcome`, and optional
   evaluator fields.

**Other MCP tools:** **`train`** (store adapter markdown), **`tune`**
(structural edits), **`export`** (markdown / datasets), **`delete`**
(memories by URI), **`spaces`** (discover space names).

## Minimal shape (illustrative)

Step A — pick a workflow:

```json
activate({})
```

Step B — start the run (adapter URI from the chosen `next_action`):

```json
forward({
  "uri": "kairos://adapter/00000000-0000-4000-8000-000000000001"
})
```

Step C — satisfy the current `contract`, then call **`forward`** again with
the **layer** URI and a matching `solution` (omit details here; see
`forward.md`).

Step D — when `next_action` says to call **`reward`**:

```json
reward({
  "uri": "kairos://layer/00000000-0000-4000-8000-000000000099?execution_id=...",
  "outcome": "success"
})
```

## Flow summary

```
activate()
  -> choices[].next_action -> forward(adapter_uri, no solution)
    -> contract + layer uri
    -> forward(layer_uri, solution)  # loop
    -> …
    -> next_action -> reward(layer_uri, outcome, …)
  -> run complete; AI may respond to the user
```

- `must_obey: true` → follow `next_action`.
- Retry failures with the **fresh** `contract` in the error payload; do not
  restart the run from `activate` unless the tool text says so.

## See also

- [Search / activation query architecture](search-query.md) — hybrid search
  pipeline behind **`activate`**.
- Embedded tool docs under [`src/embed-docs/tools/`](../../src/embed-docs/tools/).

## Companion `workflow-*.md` pages

The **`workflow-activate.md`**, **`workflow-forward-*.md`**, **`workflow-reward.md`**,
and related files in this folder are **companion narratives** aligned with this
file and with **`src/embed-docs/tools/*.md`**. They use the **current** MCP tool
names (not removed **`kairos_*`** wire names). Execution uses **`kairos://adapter/`**
and **`kairos://layer/`** URIs.
