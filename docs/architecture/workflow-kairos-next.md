# forward workflow

> **Current MCP tool:** **`forward`** with a **layer** URI and a `solution` matching `contract.type`. See [`forward.md`](../../src/embed-docs/tools/forward.md).

`forward` submits a solution for the current step's challenge and
returns the next step. Use it for steps 2 and later (step 1 uses
`kairos_begin`). On the last step, `next_action` directs the AI to call
`reward`.

## Response schema

```json
{
  "must_obey": "<boolean>",
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
  "proof_hash": "<string, optional>",
  "message": "<string, optional>",
  "error_code": "<string, optional>",
  "retry_count": "<number, optional>"
}
```

`current_step.content` contains the step body only. The challenge JSON block is
returned separately in `challenge`.

AI decision rules:

- `must_obey: true` → follow `next_action` (success or recoverable error)
- `must_obey: false` → use judgment, choose from options in `next_action`
  (max retries exceeded)

Fields that no longer exist:

- `next_step` — removed; the URI for the next call is in `next_action`
- `protocol_status` — removed; `must_obey` + `next_action` is sufficient
- `attest_required` — removed; the last step returns `next_action`
  directing the AI to call `reward`
- `genesis_hash` — renamed to `proof_hash`
- `previousProofHash` — renamed to `proof_hash` (in solution input)
- `last_proof_hash` — renamed to `proof_hash` (in response output)
- `final_challenge` — removed; the last step is a normal verification step

**Proof hash flow:**

- `challenge.proof_hash` — server-generated hash. Echo it back as
  `solution.proof_hash` in the next `forward` call.
- Top-level `proof_hash` in the response — hash of the proof just stored.
  Use it as `solution.proof_hash` for the following step.
- The AI never computes hashes. The server generates them; the AI echoes.

## Scenario 1: continue (more steps remain)

The solution is accepted and the next step is returned. The AI reads
`next_action` to get the URI for the next `forward` call.

### Input

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

### Expected output

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
    "content": "Set up configuration files.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: echo config > project/config.json",
    "nonce": "b2c3d4e5f6a1",
    "shell": {
      "cmd": "echo config > project/config.json",
      "timeout_seconds": 5
    }
  },
  "next_action": "call forward with kairos://mem/ccc33333-3333-3333-3333-333333333333 and solution matching challenge",
  "proof_hash": "7d2f8e3a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0"
}
```

### AI behavior

1. `must_obey: true` — follow `next_action`.
2. Use the top-level `proof_hash` as `solution.proof_hash` in the next
   call.
3. Read `current_step.content` for the next task.
4. Execute the challenge.
5. Read `next_action` to get the next URI.
6. Call `forward`:

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
  "solution": {
    "type": "shell",
    "nonce": "b2c3d4e5f6a1",
    "proof_hash": "7d2f8e3a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0",
    "shell": {
      "exit_code": 0,
      "stdout": "",
      "stderr": "",
      "duration_seconds": 0.2
    }
  }
}
```

## Scenario 2: completed (last step)

The solution is accepted and no more steps remain. The AI must call
`reward` as instructed by `next_action`.

### Input

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
  "solution": {
    "type": "shell",
    "nonce": "b2c3d4e5f6a1",
    "proof_hash": "7d2f8e3a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0",
    "shell": {
      "exit_code": 0,
      "stdout": "",
      "stderr": "",
      "duration_seconds": 0.2
    }
  }
}
```

### Expected output

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
    "content": "Check that everything works.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: test -f project/config.json",
    "nonce": "c3d4e5f6a1b2",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "cmd": "test -f project/config.json",
      "timeout_seconds": 5
    }
  },
  "message": "Protocol steps complete. Call reward to finalize.",
  "next_action": "call reward with kairos://mem/ccc33333-3333-3333-3333-333333333333 and outcome (success or failure) and message to complete the protocol",
  "proof_hash": "9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0"
}
```

### AI behavior

1. `must_obey: true` — follow `next_action`.
2. Call `reward` with the given URI and outcome/message:

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
  "outcome": "success",
  "message": "All 3 steps completed. Project structure created and verified."
}
```

## Scenario 3a: error — recoverable (retries 1–3)

The solution is invalid (wrong nonce, missing field, wrong type, etc.).
`must_obey: true` — the AI must follow `next_action` to retry. The
response includes a fresh `challenge` with a new nonce.

### Input (wrong nonce)

```json
{
  "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
  "solution": {
    "type": "shell",
    "nonce": "wrong-nonce-value",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": { "exit_code": 0 }
  }
}
```

### Expected output

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
    "content": "Set up configuration files.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: echo config > project/config.json",
    "nonce": "d4e5f6a1b2c3",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "cmd": "echo config > project/config.json",
      "timeout_seconds": 5
    }
  },
  "message": "Nonce mismatch. Use the nonce from this response's challenge.",
  "next_action": "retry forward with kairos://mem/bbb22222-2222-2222-2222-222222222222 -- use nonce and proof_hash from THIS response's challenge",
  "error_code": "NONCE_MISMATCH",
  "retry_count": 1
}
```

### AI behavior

1. `must_obey: true` — follow `next_action`.
2. Read `error_code` and `message` to understand what went wrong.
3. Read the fresh `challenge` — it has a new `nonce`.
4. Re-execute the command if needed, then retry `forward` with the
   corrected solution using the nonce from this response's challenge.

## Scenario 3b: error — max retries exceeded (after 3 failures)

After 3 failures, `must_obey` becomes `false`. The AI gets autonomy to
choose the best recovery path.

### Expected output

```json
{
  "must_obey": false,
  "current_step": {
    "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
    "content": "Set up configuration files.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"echo config > project/config.json\",\"timeout_seconds\":5},\"required\":true}}\n```",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: echo config > project/config.json",
    "nonce": "e5f6a1b2c3d4",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "cmd": "echo config > project/config.json",
      "timeout_seconds": 5
    }
  },
  "message": "Step failed 3 times. Use your judgment to recover.",
  "next_action": "Options: (1) call kairos_update with kairos://mem/bbb22222-2222-2222-2222-222222222222 to fix the step for future executions (2) call reward with kairos://mem/bbb22222-2222-2222-2222-222222222222 and outcome failure to abort (3) ask the user for help",
  "error_code": "MAX_RETRIES_EXCEEDED",
  "retry_count": 3
}
```

### AI behavior

`must_obey: false` — the AI has three options:

- **Fix the step:** Call `kairos_update` to improve the step content (for
  example, fix a broken command), then retry. This makes the protocol
  self-healing.
- **Abort:** Call `reward` with `outcome: failure` to end the run
  and inform the user.
- **Ask the user:** Present the problem and ask for guidance.

Choose based on `error_code` and `message`:

- `COMMAND_FAILED` → fix the command via `kairos_update`
- `USER_DECLINED` → inform the user and ask what to do
- `COMMENT_IRRELEVANT` → try a different comment approach

## Error codes

All error responses include `error_code` for monitoring and AI
decision-making:

- `NONCE_MISMATCH` — solution used wrong nonce
- `PROOF_HASH_MISMATCH` — solution used wrong `proof_hash`
- `TYPE_MISMATCH` — solution type does not match challenge type
- `MISSING_FIELD` — required field missing from solution
- `COMMENT_TOO_SHORT` — comment below minimum length
- `COMMENT_IRRELEVANT` — comment not semantically related to step
- `COMMAND_FAILED` — shell command returned non-zero exit code
- `USER_DECLINED` — user rejected confirmation prompt
- `MAX_RETRIES_EXCEEDED` — 3 retries exhausted; AI gets autonomy

## Validation rules

1. `must_obey: true` for success and recoverable errors (retries 1–3).
   `must_obey: false` only after max retries exceeded.
2. `current_step` always has `uri`, `content`, and `mimeType`.
3. `challenge` always has `type` and `description`.
4. `next_action` is always present (success, error, and max retries).
5. Top-level `proof_hash` is present when a proof was successfully stored.
6. `error_code` and `retry_count` are present on error responses.
7. These fields must not be present: `next_step`, `protocol_status`,
   `attest_required`, `genesis_hash`, `previousProofHash`,
   `last_proof_hash`, `final_challenge`.

## See also

- [kairos_begin workflow](workflow-kairos-begin.md)
- [reward workflow](workflow-kairos-attest.md)
- [kairos_update workflow](workflow-kairos-update.md)
- [Agent recovery UX](agent-recovery-ux.md)
- [Full execution workflow](workflow-full-execution.md)
