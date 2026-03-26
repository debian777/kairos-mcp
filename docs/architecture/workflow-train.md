# train workflow

> **Current MCP tool:** **`train`**. See [`train.md`](../../src/embed-docs/tools/train.md).

`train` stores adapter markdown (H1 = adapter title; H2 = layers). Use it when
the user wants to create, register, or replace stored adapter text. For
executable adapters, end each verifiable layer with a fenced JSON block using
`{"contract": ...}` (see embedded **`train`** doc) so runs can be driven by
**`activate` → forward → reward`**.

## Input schema

```json
{
  "markdown_doc": "<string, non-empty>",
  "llm_model_id": "<string, non-empty>",
  "force_update": "<boolean, optional, default false>"
}
```

Fields:

- `markdown_doc` — the markdown document to store (H1 = protocol, H2 =
  steps).
- `llm_model_id` — LLM model ID used for embedding and storage context.
- `force_update` — when `true`, overwrite an existing adapter with the same
  label. Otherwise duplicate and similarity checks apply.

## Success response schema

```json
{
  "items": [
    {
      "uri": "kairos://layer/<uuid>",
      "layer_uuid": "<uuid>",
      "adapter_uri": "kairos://adapter/<uuid>",
      "label": "<string>",
      "tags": ["<string>"]
    }
  ],
  "status": "stored"
}
```

Fields:

- `items` — one row per stored layer (see [`train_schema.ts`](../../src/tools/train_schema.ts)).
- `status` — always `"stored"` on success.

## Challenge types and examples

Add one **contract** per layer as a trailing JSON code block (authoring may
still show `"challenge"` in older examples; the runtime surface uses
**`contract`**). Use a fenced ` ```json ` block at the end of a layer.

**Shell:**

```json
{
  "challenge": {
    "type": "shell",
    "shell": {
      "cmd": "npm test",
      "timeout_seconds": 60
    },
    "required": true
  }
}
```

**Comment:**

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

**User input:**

```json
{
  "challenge": {
    "type": "user_input",
    "user_input": { "prompt": "Approve deployment?" },
    "required": true
  }
}
```

**MCP:**

```json
{
  "challenge": {
    "type": "mcp",
    "mcp": { "tool_name": "train" },
    "required": true
  }
}
```

When both an older inline challenge block and a JSON block are present in a layer,
the JSON block takes precedence.

## Scenario 1: store new protocol adapter

The document is new. All steps are stored and URIs are returned.

### Input

Example `markdown_doc` (actual request body uses `\n` for newlines in
JSON):

````
# Deploy Checklist

## Step 1: Build

Run tests.

```json
{"challenge":{"type":"shell","shell":{"cmd":"npm test","timeout_seconds":60},"required":true}}
```

## Step 2: Deploy

Deploy to staging.

```json
{"challenge":{"type":"comment","comment":{"min_length":20},"required":true}}
```
````

```json
{
  "markdown_doc": "<see example above>",
  "llm_model_id": "gpt-4o"
}
```

### Expected output

```json
{
  "items": [
    {
      "uri": "kairos://layer/aaa11111-1111-1111-1111-111111111111",
      "memory_uuid": "aaa11111-1111-1111-1111-111111111111",
      "label": "Step 1: Build",
      "tags": ["deploy", "build", "test"]
    },
    {
      "uri": "kairos://layer/bbb22222-2222-2222-2222-222222222222",
      "memory_uuid": "bbb22222-2222-2222-2222-222222222222",
      "label": "Step 2: Deploy",
      "tags": ["deploy", "staging"]
    }
  ],
  "status": "stored"
}
```

### AI behavior

Use the returned URIs for search/begin or to inform the user. To run the
protocol, call `activate` with a query matching the adapter label, then
follow `next_action`.

## Scenario 2: force_update overwrites existing adapter

An adapter with the same label exists. Set `force_update: true` to replace it.

### Input

```json
{
  "markdown_doc": "# Deploy Checklist\n\n## Step 1: Build\n...",
  "llm_model_id": "gpt-4o",
  "force_update": true
}
```

### Expected output

Same shape as scenario 1: `items` for each step (possibly new UUIDs after
replace), `status: "stored"`.

### AI behavior

Only use `force_update: true` after the user or agent has confirmed that
the existing protocol must be replaced (for example, after using
`export` to compare content).

## Scenario 3: error - `DUPLICATE_ADAPTER`

The store detected an existing adapter with the same identity and
`force_update` was not set.

### Expected output (error body)

```json
{
  "error": "DUPLICATE_ADAPTER",
  "adapter_id": "<uuid>",
  "items": []
}
```

### AI behavior

Inform the user that an adapter with this content already exists. Offer to
run it via **`activate`** / **`forward`**, or replace it with **`train`** and
**`force_update: true`** after the user confirms.

## Scenario 4: error — SIMILAR_MEMORY_FOUND

Another memory is very similar by title or label (above the similarity
threshold). The server returns a structured error so the agent can compare
and decide.

### Expected output (error body)

```json
{
  "error": "SIMILAR_MEMORY_FOUND",
  "existing_memory": {
    "uri": "kairos://adapter/ccc33333-3333-3333-3333-333333333333",
    "memory_uuid": "ccc33333-3333-3333-3333-333333333333",
    "label": "Deploy Checklist",
    "adapter_name": "Deploy Checklist",
    "score": 0.92,
    "layer_count": 2
  },
  "similarity_score": 0.92,
  "message": "A very similar memory already exists with title \"Deploy Checklist\" (similarity: 92%). Verify it before overwriting.",
  "must_obey": true,
  "next_action": "call export with uri kairos://adapter/ccc33333-3333-3333-3333-333333333333 (format markdown) to get content; compare with your train payload, then either call train with force_update: true to replace it or modify title/content to create a distinct adapter",
  "content_preview": "<optional string, truncated label + text>"
}
```

### AI behavior

1. `must_obey: true` — follow `next_action`: call **`export`** with the
   adapter or layer URI from `existing_memory.uri` and default **`format:
   markdown`** to retrieve serialized markdown in **`content`**.
2. Compare the existing content with the intended mint payload.
3. Either call `train` with `force_update: true` to replace, or
   change the document (title or content) to make it distinct and call
   `train` again.

## Scenario 5: error — STORE_FAILED

A generic storage or processing failure occurred.

### Expected output (error body)

```json
{
  "error": "STORE_FAILED",
  "message": "<server error message>"
}
```

### AI behavior

Retry if the failure is transient. Otherwise report the error to the user
and do not claim success.

## Validation rules

1. On success, `items` is a non-empty array and `status` is `"stored"`.
2. Each item has `uri`, `memory_uuid`, `label`, and `tags`.
3. Error responses are returned as MCP error content with a JSON body
   containing `error` and scenario-specific fields.
4. For `SIMILAR_MEMORY_FOUND`, `existing_memory` includes `uri` and
   `next_action` is present when the agent must follow a recovery path.

## See also

- [export workflow](workflow-export.md) — inspect existing
  content before overwriting
- [tune workflow](workflow-tune.md) — update individual
  steps
- [activate workflow](workflow-activate.md) — find existing
  protocols before minting a duplicate
