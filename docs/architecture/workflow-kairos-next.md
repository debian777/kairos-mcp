# kairos_next workflow

Submit a solution for the current step's challenge and receive the next step.
Used for steps 2+ (step 1 uses `kairos_begin`).

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

The AI decision tree:

- `must_obey: true` -> follow `next_action` (success or recoverable error)
- `must_obey: false` -> use judgment, choose from options in `next_action`
  (max retries exceeded)

Fields that no longer exist:

- `next_step` -- removed; the URI for the next call is in `next_action`
- `protocol_status` -- removed; `must_obey` + `next_action` is sufficient
- `attest_required` -- removed; last step returns "Protocol completed. No
  further steps." and `next_action: "Run complete."` — no attest step
- `genesis_hash` -- renamed to `proof_hash`
- `previousProofHash` -- renamed to `proof_hash` (in solution input)
- `last_proof_hash` -- renamed to `proof_hash` (in response output)
- `final_challenge` -- removed; last step is a normal verification step

Proof hash flow:

- `challenge.proof_hash` -- server-generated hash. Echo it back as
  `solution.proof_hash` in the next `kairos_next` call.
- Response `proof_hash` (top-level) -- hash of the proof just stored.
  Use it as `solution.proof_hash` for the following step.
- The AI never computes hashes. The server generates them; the AI echoes.

---

## Scenario 1: continue (more steps remain)

The solution is accepted. The next step is returned. The AI reads
`next_action` to get the URI for the next `kairos_next` call.

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
    "content": "Set up configuration files.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"echo config > project/config.json\",\"timeout_seconds\":5},\"required\":true}}\n```",
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
  "next_action": "call kairos_next with kairos://mem/ccc33333-3333-3333-3333-333333333333 and solution matching challenge",
  "proof_hash": "7d2f8e3a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0"
}
```

### AI behavior

1. `must_obey` is `true` -- follow `next_action`.
2. `proof_hash` (top-level) confirms the proof was stored -- use it as
   `solution.proof_hash` in the next call.
3. Read `current_step.content` for the next task.
4. Execute the challenge.
5. Read `next_action` to get the next URI.
6. Call `kairos_next`:

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

---

## Scenario 2: completed (last step)

The solution is accepted and no more steps remain. The AI must call
`kairos_attest` as instructed by `next_action`.

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
    "content": "Check that everything works.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"test -f project/config.json\",\"timeout_seconds\":5},\"required\":true}}\n```",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "comment",
    "description": "Provide a verification comment describing how you completed this step",
    "nonce": "c3d4e5f6a1b2",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "comment": {
      "min_length": 20
    }
  },
  "message": "Protocol completed. No further steps.",
  "next_action": "Run complete. Optionally call kairos_attest with kairos://mem/ccc33333-3333-3333-3333-333333333333 to override outcome or add a message.",
  "proof_hash": "9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0"
}
```

### AI behavior

1. `must_obey` is `true` -- follow `next_action`.
2. Run is complete. Optionally call `kairos_attest` to override outcome or add a message:

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
  "outcome": "success",
  "message": "All 3 steps completed. Project structure created and verified."
}
```

---

## Scenario 3a: error -- recoverable (retries 1-3)

The solution is invalid (wrong nonce, missing field, wrong type, etc.).
`must_obey` is `true` -- the AI MUST follow `next_action` to retry.
The response includes a fresh `challenge` with a new nonce so the AI
can self-correct.

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
    "content": "Set up configuration files.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"echo config > project/config.json\",\"timeout_seconds\":5},\"required\":true}}\n```",
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
  "next_action": "retry kairos_next with kairos://mem/bbb22222-2222-2222-2222-222222222222 -- use nonce and proof_hash from THIS response's challenge",
  "error_code": "NONCE_MISMATCH",
  "retry_count": 1
}
```

### AI behavior

1. `must_obey` is `true` -- follow `next_action`.
2. Read `error_code` and `message` to understand what went wrong.
3. Read the fresh `challenge` -- it has a new `nonce`.
4. Re-execute the command if needed, then retry `kairos_next` with the
   corrected solution using the nonce from THIS response's challenge.

---

## Scenario 3b: error -- max retries exceeded (after 3 failures)

The AI has failed 3 times on this step. `must_obey` becomes `false` --
the AI gets autonomy to decide the best recovery path. Options include
fixing the broken step for future executions, aborting, or asking the user.

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
  "next_action": "Options: (1) call kairos_update with kairos://mem/bbb22222-2222-2222-2222-222222222222 to fix the step for future executions (2) call kairos_attest with kairos://mem/bbb22222-2222-2222-2222-222222222222 and outcome failure to abort (3) ask the user for help",
  "error_code": "MAX_RETRIES_EXCEEDED",
  "retry_count": 3
}
```

### AI behavior

1. `must_obey` is `false` -- the AI has options:
   - **Fix the step**: Call `kairos_update` to improve the step content
     (e.g., fix a broken command), then retry. This makes KAIROS
     self-healing -- broken steps get improved for future executions.
   - **Abort**: Call `kairos_attest` with `outcome: failure` to end the
     protocol and inform the user.
   - **Ask the user**: Present the problem and ask for guidance.
2. The AI should choose based on the `error_code` and `message`:
   - `COMMAND_FAILED` -> try fixing the command via `kairos_update`
   - `USER_DECLINED` -> inform the user and ask what to do
   - `COMMENT_IRRELEVANT` -> try a different comment approach

---

## Error codes

All error responses include `error_code` for monitoring and AI decision-making:

- `NONCE_MISMATCH` -- solution used wrong nonce
- `PROOF_HASH_MISMATCH` -- solution used wrong proof_hash
- `TYPE_MISMATCH` -- solution type doesn't match challenge type
- `MISSING_FIELD` -- required field missing from solution
- `COMMENT_TOO_SHORT` -- comment below minimum length
- `COMMENT_IRRELEVANT` -- comment not semantically related to step
- `COMMAND_FAILED` -- shell command returned non-zero exit code
- `USER_DECLINED` -- user rejected confirmation prompt
- `MAX_RETRIES_EXCEEDED` -- 3 retries exhausted, AI gets autonomy

---

## Validation rules

1. `must_obey` is `true` for success and recoverable errors (retries 1-3).
   `must_obey` is `false` only after max retries exceeded.
2. `current_step` always has `uri`, `content`, `mimeType`.
3. `challenge` always has `type` and `description`.
4. `next_action` is ALWAYS present (success, error, and max retries).
5. `proof_hash` (top-level) is present when a proof was successfully stored.
6. `error_code` and `retry_count` are present on error responses.
7. The following fields must NOT be present: `next_step`,
   `protocol_status`, `attest_required`, `genesis_hash`,
   `previousProofHash`, `last_proof_hash`, `final_challenge`.
