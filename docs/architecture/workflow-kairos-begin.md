# kairos_begin workflow

Loads step 1 of a protocol and returns the first challenge. Step 1 never
requires a solution. If a non-step-1 URI is provided, auto-redirects to
step 1.

## Response schema

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/<uuid>",
    "content": "<markdown body>",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "<shell|mcp|user_input|comment>",
    "description": "<string>",
    "nonce": "<string, optional>",
    "proof_hash": "<string, optional>"
  },
  "next_action": "<string>",
  "message": "<string, optional>"
}
```

The AI decision tree:

- `must_obey: true` -> follow `next_action`
- `must_obey: false` -> use judgment, choose from options in `next_action`

Fields that no longer exist:

- `next_step` -- removed; the URI for the next call is in `next_action`
- `protocol_status` -- removed; `next_action` tells the AI what to do next
- `attest_required` -- removed; for single-step protocols `next_action` says
  "Run complete." (no attest)
- `genesis_hash` -- renamed to `proof_hash`
- `final_challenge` -- removed; last step is a normal verification step

---

## Scenario 1: multi-step protocol (continue)

The protocol has more than 1 step. After begin, the AI executes the
challenge and calls `kairos_next` with the URI from `next_action`.

### Input

```json
{
  "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111"
}
```

### Expected output

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
    "content": "Create the project directory structure.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"mkdir -p src\",\"timeout_seconds\":30},\"required\":true}}\n```",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: mkdir -p src",
    "nonce": "a1b2c3d4e5f6",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "cmd": "mkdir -p src",
      "timeout_seconds": 30
    }
  },
  "next_action": "call kairos_next with kairos://mem/bbb22222-2222-2222-2222-222222222222 and solution matching challenge"
}
```

### AI behavior

1. `must_obey` is `true` -- follow `next_action`.
2. Read `current_step.content` to understand what to do.
3. Read `challenge` to know the required proof.
4. Execute the shell command `mkdir -p src`.
5. Read `next_action` to get the next URI.
6. Call `kairos_next` with the URI and solution:

```json
{
  "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
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

---

## Scenario 2: single-step protocol (completed)

The protocol has only 1 step. After begin, the AI must call `kairos_attest`
as instructed by `next_action`.

### Input

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333"
}
```

### Expected output

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
    "content": "Review the coding standards and confirm understanding.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "comment",
    "description": "Provide a verification comment (minimum 20 characters)",
    "nonce": "f6e5d4c3b2a1",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "comment": {
      "min_length": 20
    }
  },
  "message": "Protocol completed. Call kairos_attest to finalize.",
  "next_action": "call kairos_attest with kairos://mem/ccc33333-3333-3333-3333-333333333333, outcome, and message"
}
```

### AI behavior

1. `must_obey` is `true` -- follow `next_action`.
2. Read `current_step.content` and execute the challenge.
3. `next_action` says "call kairos_attest" -- so call it:

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
  "outcome": "success",
  "message": "Reviewed coding standards and confirmed understanding."
}
```

---

## Scenario 3: auto-redirect (non-step-1 URI)

The AI called `kairos_begin` on a step that is not step 1. KAIROS
auto-redirects to step 1 of the same chain and presents it normally.

### Input

```json
{
  "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222"
}
```

### Expected output

The response is the same as if step 1 had been requested directly. KAIROS
resolves the chain, finds step 1, and returns it:

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
    "content": "Create the project directory structure.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"mkdir -p src\",\"timeout_seconds\":30},\"required\":true}}\n```",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: mkdir -p src",
    "shell": {
      "cmd": "mkdir -p src",
      "timeout_seconds": 30
    }
  },
  "message": "Redirected to step 1 of this protocol chain.",
  "next_action": "call kairos_next with kairos://mem/bbb22222-2222-2222-2222-222222222222 and solution matching challenge"
}
```

### AI behavior

Transparent to the AI -- it called begin, got step 1. Proceeds normally.

---

## Validation rules

1. `must_obey` is `true` for all `kairos_begin` responses (no retry
   escalation applies here since step 1 never requires a solution).
2. `current_step` always has `uri`, `content`, `mimeType`.
3. `challenge` always has `type` and `description`.
4. `next_action` is always present and contains a `kairos://mem/` URI.
5. The following fields must NOT be present: `next_step`,
   `protocol_status`, `attest_required`, `genesis_hash`, `final_challenge`,
   `final_solution`.
