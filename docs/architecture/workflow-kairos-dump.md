# export workflow

> **Current MCP tool:** **`export`**. See [`export.md`](../../src/embed-docs/tools/export.md).

**`export`** returns serialized **content** for an **adapter** or **layer** URI.
It does not advance an execution (no `execution_id` progression), issue
nonces, or return `next_action` / `must_obey` the way **`forward`** does.

## Input schema

```json
{
  "uri": "kairos://adapter/<uuid>",
  "format": "markdown",
  "include_reward": true
}
```

Fields:

- **`uri`** — **`kairos://adapter/{uuid}`** or **`kairos://layer/{uuid}`** (with
  optional **`?execution_id=`** when applicable).
- **`format`** — `markdown` (default), `trace_jsonl`, `sft_jsonl`, or
  `preference_jsonl`.
- **`include_reward`** — affects trace-style formats; see schema.

## Response schema (markdown format)

```json
{
  "uri": "kairos://adapter/<uuid>",
  "format": "markdown",
  "content_type": "text/markdown",
  "content": "<serialized markdown>",
  "item_count": 1,
  "adapter_name": "<string or null>",
  "adapter_version": "<string or null>"
}
```

Markdown exports normalize headings and JSON keys toward the current adapter
vocabulary (for example **`contract`** rather than **`challenge`** in embedded
JSON blocks).

## Typical use

1. After **`activate`**, pick the adapter you need to inspect.
2. Call **`export`** with that **`kairos://adapter/{uuid}`** (or a specific
   layer URI).
3. Edit the returned **`content`**, then apply changes with **`tune`** (or
   re-register via **`train`** when replacing whole adapter text).

## See also

- [`export_schema.ts`](../../src/tools/export_schema.ts)
- [train workflow](workflow-kairos-mint.md)
- [tune workflow](workflow-kairos-update.md)
