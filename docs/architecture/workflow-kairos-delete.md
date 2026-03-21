# kairos_delete workflow

> **Current MCP tool:** **`delete`**. See [`delete.md`](../../src/embed-docs/tools/delete.md).

`kairos_delete` deletes one or more KAIROS memories by URI. Use it when
the user wants to delete, remove, purge, or clean KAIROS content. Resolve
target URIs first (for example, via `kairos_search` or chain navigation).
Each URI is deleted independently; partial success is possible.

## Input schema

```json
{
  "uris": ["kairos://mem/<uuid>", "..."]
}
```

Fields:

- `uris` — non-empty array of `kairos://mem/{uuid}` URIs to delete.

## Response schema

```json
{
  "results": [
    {
      "uri": "kairos://mem/<uuid>",
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
example, from search or from a step in a chain).

### Input

```json
{
  "uris": ["kairos://mem/aaa11111-1111-1111-1111-111111111111"]
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
      "status": "deleted",
      "message": "Memory kairos://mem/aaa11111-1111-1111-1111-111111111111 deleted successfully"
    }
  ],
  "total_deleted": 1,
  "total_failed": 0
}
```

### AI behavior

Confirm deletion to the user. If the URI was a step in a chain, note that
other steps of the same chain are not automatically deleted. Delete them
explicitly when the user wants the whole chain removed.

## Scenario 2: delete multiple memories (full chain)

The agent deletes all steps of a protocol chain. URIs come from search
plus chain navigation.

### Input

```json
{
  "uris": [
    "kairos://mem/aaa11111-1111-1111-1111-111111111111",
    "kairos://mem/bbb22222-2222-2222-2222-222222222222",
    "kairos://mem/ccc33333-3333-3333-3333-333333333333"
  ]
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
      "status": "deleted",
      "message": "Memory kairos://mem/aaa11111-1111-1111-1111-111111111111 deleted successfully"
    },
    {
      "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
      "status": "deleted",
      "message": "Memory kairos://mem/bbb22222-2222-2222-2222-222222222222 deleted successfully"
    },
    {
      "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
      "status": "deleted",
      "message": "Memory kairos://mem/ccc33333-3333-3333-3333-333333333333 deleted successfully"
    }
  ],
  "total_deleted": 3,
  "total_failed": 0
}
```

### AI behavior

Confirm how many memories were deleted. When the user asked to remove a
protocol, verify that all step URIs for that protocol were included.

## Scenario 3: partial failure

Some URIs are deleted; others fail (for example, UUID not found, or already
deleted). Each result has its own `status` and `message`.

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
      "status": "deleted",
      "message": "Memory kairos://mem/aaa11111-1111-1111-1111-111111111111 deleted successfully"
    },
    {
      "uri": "kairos://mem/nonexistent-0000-0000-0000-000000000000",
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

1. `uris` must be a non-empty array of valid `kairos://mem/{uuid}` strings.
2. `total_deleted` + `total_failed` equals `results.length`.
3. Each result has `uri`, `status` (`"deleted"` or `"error"`), and
   `message`.
4. Deleting a memory does not automatically delete other steps in the same
   chain. Pass all step URIs to remove an entire protocol.

## See also

- [kairos_search workflow](workflow-kairos-search.md) — obtain URIs before
  deleting
- [kairos_dump workflow](workflow-kairos-dump.md) — inspect content before
  deleting
