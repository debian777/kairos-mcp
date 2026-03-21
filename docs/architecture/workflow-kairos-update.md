# kairos_update workflow

> **Current MCP tool:** **`tune`**. See [`tune.md`](../../src/embed-docs/tools/tune.md).

`kairos_update` updates one or more KAIROS memories by URI. Use it when
the user wants to replace, modify, update, edit, or change existing
content. Prefer `markdown_doc` for content changes; use `updates` for
targeted field-level changes. `forward` references this tool when max
retries are exceeded and the agent chooses to fix a broken step.

## Input schema

```json
{
  "uris": ["kairos://mem/<uuid>", "..."],
  "markdown_doc": ["<string>", "..."],
  "updates": { "<key>": "<value>", "..." }
}
```

Fields:

- `uris` — non-empty array of `kairos://mem/{uuid}` URIs to update.
- `markdown_doc` — optional. Array of markdown strings; length must match
  `uris`. Each string is the new body or full KAIROS render. When
  `<!-- KAIROS-BODY-START -->` / `<!-- KAIROS-BODY-END -->` markers are
  present, only the body between them is extracted and stored as `text`.
- `updates` — optional. Record of field names to values applied to each
  URI. If `updates.text` contains KAIROS body markers, the body is
  extracted and stored as `text`; otherwise updates are applied as-is.

Provide exactly one of `markdown_doc` or `updates`.

## Response schema

```json
{
  "results": [
    {
      "uri": "kairos://mem/<uuid>",
      "status": "updated | error",
      "message": "<string>"
    }
  ],
  "total_updated": "<number>",
  "total_failed": "<number>"
}
```

Fields:

- `results` — one entry per URI; `status` is `"updated"` or `"error"`.
- `total_updated` — count of URIs successfully updated.
- `total_failed` — count of URIs that failed.

## Scenario 1: update by markdown_doc (single memory)

The agent updates one step with new markdown content.

### Input

Example document for the single step (actual payload uses `\n` in JSON):

````
Set up configuration files.

```json
{"challenge":{"type":"shell","shell":{"cmd":"echo config > project/config.json","timeout_seconds":10},"required":true}}
```
````

```json
{
  "uris": ["kairos://mem/bbb22222-2222-2222-2222-222222222222"],
  "markdown_doc": ["<see example above>"]
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
      "status": "updated",
      "message": "Memory kairos://mem/bbb22222-2222-2222-2222-222222222222 updated successfully"
    }
  ],
  "total_updated": 1,
  "total_failed": 0
}
```

### AI behavior

Use this after fixing a broken step (for example, when `forward`
returned `MAX_RETRIES_EXCEEDED` and the agent chose to fix the step). Then
retry `forward` or inform the user that the protocol was updated.

## Scenario 2: update multiple memories (markdown_doc)

The agent updates several steps in one call. `markdown_doc` length must
match `uris` length.

### Input

Step 1 document:

````
Create the project directory.

```json
{"challenge":{"type":"shell","shell":{"cmd":"mkdir -p src","timeout_seconds":30},"required":true}}
```
````

Step 2 document:

````
Write config.

```json
{"challenge":{"type":"shell","shell":{"cmd":"echo '{}' > config.json","timeout_seconds":5},"required":true}}
```
````

```json
{
  "uris": [
    "kairos://mem/aaa11111-1111-1111-1111-111111111111",
    "kairos://mem/bbb22222-2222-2222-2222-222222222222"
  ],
  "markdown_doc": ["<step 1 document above>", "<step 2 document above>"]
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
      "status": "updated",
      "message": "Memory kairos://mem/aaa11111-1111-1111-1111-111111111111 updated successfully"
    },
    {
      "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
      "status": "updated",
      "message": "Memory kairos://mem/bbb22222-2222-2222-2222-222222222222 updated successfully"
    }
  ],
  "total_updated": 2,
  "total_failed": 0
}
```

### AI behavior

Check `results` to see which URIs succeeded. When `total_failed` is greater
than zero, report failures to the user or retry the failed URIs.

## Scenario 3: update by updates (field-level)

The agent sends raw field updates. Use when not supplying full markdown.

### Input

```json
{
  "uris": ["kairos://mem/ccc33333-3333-3333-3333-333333333333"],
  "updates": {
    "text": "Revised step body."
  }
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
      "status": "updated",
      "message": "Memory kairos://mem/ccc33333-3333-3333-3333-333333333333 updated successfully"
    }
  ],
  "total_updated": 1,
  "total_failed": 0
}
```

### AI behavior

Use for small or field-specific changes. For full step content, prefer
`markdown_doc` so structure and challenge blocks stay consistent.

## Scenario 4: partial failure

Some URIs update successfully; others fail (for example, missing memory or
invalid UUID). Each result has its own `status` and `message`.

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
      "status": "updated",
      "message": "Memory kairos://mem/aaa11111-1111-1111-1111-111111111111 updated successfully"
    },
    {
      "uri": "kairos://mem/nonexistent-0000-0000-0000-000000000000",
      "status": "error",
      "message": "Failed to update memory: Point not found"
    }
  ],
  "total_updated": 1,
  "total_failed": 1
}
```

### AI behavior

Report which URIs failed and why. Do not treat the call as fully successful
when `total_failed` > 0.

## Validation rules

1. `uris` must be a non-empty array of valid `kairos://mem/{uuid}` strings.
2. When `markdown_doc` is provided, its length must equal `uris.length`.
3. Provide exactly one of `markdown_doc` or `updates`; otherwise the server
   returns an error (for example, "Provide markdown_doc or updates").
4. `total_updated` + `total_failed` equals `results.length`.
5. Each result has `uri`, `status` (`"updated"` or `"error"`), and
   `message`.

## See also

- [export workflow](workflow-kairos-dump.md) — read content before
  updating
- [forward workflow](workflow-kairos-next.md) — references
  `kairos_update` in the max-retries recovery path
