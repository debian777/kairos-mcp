# Forward: first call (adapter URI)

> **There is no separate “begin” tool.** To load the first layer of an adapter
> run, call **`forward`** once with a **`kairos://adapter/{uuid}`** from
> **`activate`** and **omit** `solution`. See
> [`forward.md`](../../src/embed-docs/tools/forward.md).

The server returns the first **`contract`**, optional **`current_layer`**
(markdown + layer URI), **`execution_id`** when a new run starts, and
**`next_action`** (usually another **`forward`** on the layer URI with a
matching **`solution`**, or **`reward`** on a single-layer adapter).

## Response shape (illustrative)

```json
{
  "must_obey": true,
  "current_layer": {
    "uri": "kairos://layer/bbb22222-2222-2222-2222-222222222222",
    "content": "<markdown body for this layer>",
    "mimeType": "text/markdown"
  },
  "contract": {
    "type": "shell",
    "description": "Execute shell command: mkdir -p src",
    "nonce": "a1b2c3d4e5f6",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "cmd": "mkdir -p src",
      "timeout_seconds": 30
    }
  },
  "next_action": "call forward with kairos://layer/bbb22222-2222-2222-2222-222222222222?execution_id=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee and solution matching contract",
  "execution_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
}
```

Contract **`type`** is one of **`tensor`**, **`shell`**, **`mcp`**,
**`user_input`**, **`comment`**. Echo server **`nonce`** and **`proof_hash`**
when the contract requires them.

## First call input

```json
{
  "uri": "kairos://adapter/aaa11111-1111-1111-1111-111111111111"
}
```

No `solution` field on this call.

## AI behavior

1. `must_obey: true` → follow **`next_action`**.
2. Read **`current_layer.content`** for human-facing instructions.
3. Read **`contract`** for the proof you must satisfy.
4. Call **`forward`** again with the **layer** URI from `current_layer.uri`
   (include `?execution_id=` when the server returned one) and a **`solution`**
   whose **`type`** matches **`contract.type`**.

## Single-layer run

If the adapter has one layer, the first **`forward`** may already point to
**`reward`** in **`next_action`**. You still satisfy the contract via
**`forward`** (with a solution) when needed; **`reward`** uses the **final
layer** URI from the tool text, with optional **`?execution_id=`**.

## Non–step-1 entry (redirect)

If you mistakenly pass a **layer** URI as the first call where the server
expects the chain head, resolution behavior is defined in **`forward`** /
store logic; always prefer the **adapter** URI from **`activate`**.

## Validation rules

1. First call uses **`kairos://adapter/{uuid}`** only; omit **`solution`**.
2. **`contract`** is always present; **`current_layer`** may be null in edge
   cases—obey **`next_action`** regardless.
3. **`next_action`** is authoritative for the next tool invocation.
4. Prefer **`execution_id`** continuity across layer **`forward`** calls when
   the URI or docs say to include it.

## See also

- [activate workflow](workflow-activate.md)
- [Subsequent forward calls](workflow-forward-continue.md)
- [reward workflow](workflow-reward.md)
- [Full execution workflow](workflow-full-execution.md)
