# delete workflow

> **Current MCP tool:** **`delete`**. See [`delete.md`](../../src/embed-docs/tools/delete.md).

`delete` removes one or more **adapter** or **layer** resources by URI (see
[`delete_schema.ts`](../../src/tools/delete_schema.ts)). Resolve targets first
(for example via **`activate`** or **`export`**). Each URI is processed
independently; partial success is possible.

## Input schema

```json
{
  "uris": ["kairos://adapter/<uuid>", "..."]
}
```

Fields:

- `uris` — non-empty array of **`kairos://adapter/{uuid}`** or
  **`kairos://layer/{uuid}`** (optional **`?execution_id=`**) URIs to delete.

## Response schema

```json
{
  "results": [
    {
      "uri": "kairos://adapter/<uuid>",
      "status": "deleted | error",
      "message": "<string>"
    }
  ],
  "total_deleted": "<number>",
  "total_failed": "<number>"
}
```

Fields:

- `results` — one entry per URI; `status` is `"deleted"` or `"error"`.
- `total_deleted` — count of URIs successfully deleted.
- `total_failed` — count of URIs that failed to delete.

## Scenario 1: delete one memory

The user asks to remove a single memory. The agent has the URI (for
example, from search or from a layer in an adapter).

### Input

```json
{
  "uris": ["kairos://adapter/aaa11111-1111-1111-1111-111111111111"]
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://adapter/aaa11111-1111-1111-1111-111111111111",
      "status": "deleted",
      "message": "Memory kairos://adapter/aaa11111-1111-1111-1111-111111111111 deleted successfully"
    }
  ],
  "total_deleted": 1,
  "total_failed": 0
}
```

### AI behavior

Confirm deletion to the user. If the URI was a layer in an adapter, note that
other layers of the same adapter are not automatically deleted. Delete them
explicitly when the user wants the whole adapter removed.

## Scenario 2: delete multiple memories (full adapter)

The agent deletes all layers of an adapter. URIs come from search
plus adapter navigation.

### Input

```json
{
  "uris": [
    "kairos://adapter/aaa11111-1111-1111-1111-111111111111",
    "kairos://adapter/bbb22222-2222-2222-2222-222222222222",
    "kairos://adapter/ccc33333-3333-3333-3333-333333333333"
  ]
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://adapter/aaa11111-1111-1111-1111-111111111111",
      "status": "deleted",
      "message": "Memory kairos://adapter/aaa11111-1111-1111-1111-111111111111 deleted successfully"
    },
    {
      "uri": "kairos://adapter/bbb22222-2222-2222-2222-222222222222",
      "status": "deleted",
      "message": "Memory kairos://adapter/bbb22222-2222-2222-2222-222222222222 deleted successfully"
    },
    {
      "uri": "kairos://adapter/ccc33333-3333-3333-3333-333333333333",
      "status": "deleted",
      "message": "Memory kairos://adapter/ccc33333-3333-3333-3333-333333333333 deleted successfully"
    }
  ],
  "total_deleted": 3,
  "total_failed": 0
}
```

### AI behavior

Confirm how many memories were deleted. When the user asked to remove an
adapter, verify that all step URIs for that adapter were included.

## Scenario 3: partial failure

Some URIs are deleted; others fail (for example, UUID not found, or already
deleted). Each result has its own `status` and `message`.

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://adapter/aaa11111-1111-1111-1111-111111111111",
      "status": "deleted",
      "message": "Memory kairos://adapter/aaa11111-1111-1111-1111-111111111111 deleted successfully"
    },
    {
      "uri": "kairos://adapter/nonexistent-0000-0000-0000-000000000000",
      "status": "error",
      "message": "Failed to delete memory: Point not found"
    }
  ],
  "total_deleted": 1,
  "total_failed": 1
}
```

### AI behavior

Report which URIs were deleted and which failed. Do not claim full success
when `total_failed` > 0.

## Validation rules

1. `uris` must be a non-empty array of valid **`kairos://adapter/{uuid}`** or **`kairos://layer/{uuid}`** strings (see schema).
2. `total_deleted` + `total_failed` equals `results.length`.
3. Each result has `uri`, `status` (`"deleted"` or `"error"`), and
   `message`.
4. Deleting a memory does not automatically delete other layers in the same
   adapter. Pass all layer URIs to remove an entire adapter chain.

## See also

- [activate workflow](workflow-activate.md) — obtain URIs before
  deleting
- [export workflow](workflow-export.md) — inspect content before
  deleting
