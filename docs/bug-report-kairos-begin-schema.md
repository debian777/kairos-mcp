# Bug Report: KAIROS MCP `kairos_begin` schema validation error

## Summary

Calling the KAIROS MCP tool `kairos_begin` with a valid protocol URI returns an MCP error `-32602` because the server response includes extra properties in `data/challenge` that the client schema does not allow.

## Description

When following the ELITE AI CODING STANDARDS protocol flow:

1. `kairos_search` is called with query `"PROTOCOL: ELITE AI CODING STANDARDS"`.
2. Search returns choices; user selects the protocol with URI `kairos://mem/a07e729a-5fa1-4f0d-a7bd-77c318a0cd98`.
3. `kairos_begin` is called with that URI.
4. The MCP server responds with a payload that includes a `challenge` object with additional properties beyond what the tool’s output schema permits.
5. The MCP client rejects the response with a schema validation error.

## Steps to reproduce

1. Connect an MCP client (e.g. Cursor with KAIROS MCP) to the KAIROS server.
2. Call `kairos_search` with query: `"PROTOCOL: ELITE AI CODING STANDARDS"`.
3. From the returned `choices`, pick the entry with `chain_label` `"PROTOCOL: ELITE AI CODING STANDARDS"` and note its `uri`.
4. Call `kairos_begin` with that `uri`.
5. Observe the `-32602` error and the message about `data/challenge` and additional properties.

## Expected behavior

- `kairos_begin` returns successfully with the first step content, `challenge`, `protocol_status`, and `next_step` (if any).
- The response conforms to the MCP tool’s declared output schema so the client does not raise a validation error.

## Actual behavior

- The MCP layer returns error code `-32602` (Invalid params or invalid response shape).
- Error message: `Structured content does not match the tool's output schema: data/challenge must NOT have additional properties, data/challenge must NOT have additional properties`.

## Raw JSON calls

### 1. Request: `kairos_search`

**MCP tool call (conceptual request):**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "kairos_search",
    "arguments": {
      "query": "PROTOCOL: ELITE AI CODING STANDARDS"
    }
  }
}
```

**Response (success, truncated):**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"must_obey\":false,\"multiple_perfect_matches\":9,\"message\":\"Great! We have 9 canonical protocols...\",\"choices\":[{\"uri\":\"kairos://mem/a07e729a-5fa1-4f0d-a7bd-77c318a0cd98\",\"label\":\"FEATURE BRANCH ISOLATION\",\"chain_label\":\"PROTOCOL: ELITE AI CODING STANDARDS\"},...]}"
      }
    ]
  }
}
```

### 2. Request: `kairos_begin` (failing call)

**MCP tool call (conceptual request):**

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": {
    "name": "kairos_begin",
    "arguments": {
      "uri": "kairos://mem/a07e729a-5fa1-4f0d-a7bd-77c318a0cd98"
    }
  }
}
```

**Response (raw error):**

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "error": {
    "code": -32602,
    "message": "Structured content does not match the tool's output schema: data/challenge must NOT have additional properties, data/challenge must NOT have additional properties"
  }
}
```

So the server _did_ return a result (with a `challenge` object), but the client’s schema for the tool’s result forbids additional properties on `challenge`. The actual response body from the server (the “success” payload that was then rejected by the client) is not visible in this error; it would need to be captured on the server or from a client that logs the raw response before validation.

## Environment

- **Client:** Cursor IDE with MCP (KAIROS MCP server).
- **KAIROS MCP:** repo `kairos-mcp`, branch `feat/simplify-kairos-teaching-stack`.
- **OS:** darwin 25.3.0.
- **Date observed:** 2025-02-15.

## Possible causes

1. **Server:** The KAIROS backend returns a `challenge` object with more fields than the MCP tool’s output schema defines (e.g. extra optional or future fields).
2. **Schema:** The MCP tool definition for `kairos_begin` declares `challenge` with `additionalProperties: false` (or a strict schema), so any extra key in `challenge` triggers the error.

## Suggested fix

- **Option A:** Update the MCP tool’s result schema for `kairos_begin` so that `challenge` allows additional properties (e.g. `additionalProperties: true` or an explicit list of optional fields), and document all current and optional fields.
- **Option B:** Change the KAIROS server so that the response for `kairos_begin` only includes `challenge` fields that are defined in the current MCP schema; strip or move any extra fields elsewhere (e.g. a separate `meta` or `debug` object).

Capturing the full JSON response body of the successful (pre-validation) server response would confirm which properties are present on `challenge` and guide the schema or server change.
