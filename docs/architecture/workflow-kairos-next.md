# Forward: subsequent calls (layer URI + solution)

> **Current MCP tool:** **`forward`** with a **`kairos://layer/{uuid}`** URI
> (and **`?execution_id=`** when the run uses it) and a **`solution`** whose
> **`type`** matches **`contract.type`**. See
> [`forward.md`](../../src/embed-docs/tools/forward.md).

Use this after the **first** **`forward`** (adapter URI, no solution). Each
response exposes a **`contract`** for the current layer and a **`next_action`**
that names the next **`forward`** or **`reward`**.

## Response schema (illustrative)

```json
{
  "must_obey": true,
  "current_layer": {
    "uri": "kairos://layer/ccc33333-3333-3333-3333-333333333333",
    "content": "<markdown body>",
    "mimeType": "text/markdown"
  },
  "contract": {
    "type": "comment",
    "description": "Provide a verification comment (minimum 20 characters)",
    "nonce": "f6e5d4c3b2a1",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "comment": { "min_length": 20 }
  },
  "next_action": "call forward with kairos://layer/ccc33333-3333-3333-3333-333333333333?execution_id=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee and solution matching contract",
  "proof_hash": "…"
}
```

## Example: shell solution

### Input

```json
{
  "uri": "kairos://layer/bbb22222-2222-2222-2222-222222222222?execution_id=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "solution": {
    "type": "shell",
    "nonce": "a1b2c3d4e5f6",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "exit_code": 0,
      "stdout": "",
      "stderr": "",
      "duration_seconds": 0.1
    }
  }
}
```

### AI behavior

1. `must_obey: true` → follow **`next_action`**.
2. Use the **layer** URI from the previous response (not the adapter URI).
3. Echo **`nonce`** / **`proof_hash`** exactly when the contract requires them.

## Last layer → reward

When **`next_action`** directs you to **`reward`**:

```json
{
  "uri": "kairos://layer/ccc33333-3333-3333-3333-333333333333?execution_id=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "outcome": "success",
  "message": "All layers completed."
}
```

Use only **layer** URIs for **`reward`** (see
[`reward.md`](../../src/embed-docs/tools/reward.md)).

## Errors and retries

On recoverable errors, **`must_obey`** may stay **`true`** and the response
includes a fresh **`contract`** (new nonce). Retry **`forward`** with the URI
from **`next_action`**—do not restart from **`activate`** unless the tool text
says so.

When **`must_obey`** is **`false`** (for example, max retries), **`next_action`**
may list options such as **`tune`** to fix stored content, **`reward`** with
**`failure`**, or asking the user—follow that text.

## Validation rules

1. **`solution.type`** must match **`contract.type`**.
2. **`current_layer.uri`** is always a **`kairos://layer/...`** URI.
3. **`proof_hash`** in the response is for chaining proofs; echo the correct
   hash source described in **`forward`** / **`next_action`**.

## See also

- [First forward call](workflow-kairos-begin.md)
- [reward workflow](workflow-kairos-attest.md)
- [Full execution workflow](workflow-full-execution.md)
