# tune workflow

> **Current MCP tool:** **`tune`**. See [`tune.md`](../../src/embed-docs/tools/tune.md).

**`tune`** updates stored adapter bodies or fields. Pass **`kairos://adapter/{uuid}`**
and/or **`kairos://layer/{uuid}`** URIs (optional **`?execution_id=`** on layers).
The server resolves them to the underlying stored records.

## Input schema

```json
{
  "uris": ["kairos://layer/<uuid>", "..."],
  "markdown_doc": ["<string>", "..."],
  "updates": { "<key>": "<value>" }
}
```

Provide exactly one of **`markdown_doc`** or **`updates`**. When using
**`markdown_doc`**, the array length must match **`uris`**.

### Body markers

When **`markdown_doc`** strings include `<!-- KAIROS-BODY-START -->` /
`<!-- KAIROS-BODY-END -->`, only the enclosed region is applied as the stored
body (see server implementation).

## Response schema

```json
{
  "results": [
    {
      "uri": "kairos://layer/<uuid>",
      "status": "updated",
      "message": "<string>"
    }
  ],
  "total_updated": 1,
  "total_failed": 0
}
```

## Typical use

1. **`export`** an adapter or layer to obtain current markdown (**`content`**).
2. Edit offline.
3. **`tune`** with the same target URIs and parallel **`markdown_doc`** entries.

## Recovery hint

When **`forward`** returns **`must_obey: false`** after retries, **`next_action`**
may mention **`tune`** as a way to repair broken stored layers before new runs.

## See also

- [`tune_schema.ts`](../../src/tools/tune_schema.ts)
- [export workflow](workflow-kairos-dump.md)
- [forward workflow](workflow-kairos-next.md)
