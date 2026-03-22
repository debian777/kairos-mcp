# Full execution workflow: search to attest

End-to-end walkthrough of a complete KAIROS protocol run. Every step shows
the raw JSON call and response. After search, the AI picks one choice and
follows that choice's `next_action`. The run completes when the AI calls
`kairos_attest` as directed by the last `kairos_next`.

## The protocol

A 3-step "Simple Setup Protocol" with shell challenges:

```markdown
# Simple Setup Protocol

## Step 1: Initialize

Create the project directory structure.

```json
{"challenge":{"type":"shell","shell":{"cmd":"mkdir -p project/src","timeout_seconds":10},"required":true}}
```

## Step 2: Configure

Set up configuration files.

```json
{"challenge":{"type":"shell","shell":{"cmd":"echo \"config\" > project/config.json","timeout_seconds":5},"required":true}}
```

## Step 3: Verify

Check that everything works.

```json
{"challenge":{"type":"shell","shell":{"cmd":"test -f project/config.json","timeout_seconds":5},"required":true}}
```
```

## Step 0: search

User says: "run the simple setup protocol"

### Call

```json
kairos_search({
  "query": "simple setup protocol"
})
```

### Response

```json
{
  "must_obey": true,
  "message": "Found 1 match.",
  "next_action": "Follow the choice's next_action.",
  "choices": [
    {
      "uri": "kairos://mem/step1-uuid-1111-1111-111111111111",
      "label": "Initialize / Configure / Verify",
      "chain_label": "Simple Setup Protocol",
      "score": 0.58,
      "role": "match",
      "tags": ["setup", "project", "simple"],
      "next_action": "call kairos_begin with kairos://mem/step1-uuid-1111-1111-111111111111 to execute protocol"
    }
  ]
}
```

The AI reads the global `next_action` — follow the choice's `next_action`.
The single choice says to call `kairos_begin` with the given URI.

## Step 1: begin

### Call

```json
kairos_begin({
  "uri": "kairos://mem/step1-uuid-1111-1111-111111111111"
})
```

### Response

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/step1-uuid-1111-1111-111111111111",
    "content": "Create the project directory structure.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: mkdir -p project/src",
    "nonce": "nonce-aaa",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "cmd": "mkdir -p project/src",
      "timeout_seconds": 10
    }
  },
  "next_action": "call kairos_next with kairos://mem/step2-uuid-2222-2222-222222222222 and solution matching challenge"
}
```

The AI executes `mkdir -p project/src` (exit code 0). The `next_action`
gives the URI for the next step.

## Step 2: next (step 2 of 3)

### Call

```json
kairos_next({
  "uri": "kairos://mem/step2-uuid-2222-2222-222222222222",
  "solution": {
    "type": "shell",
    "nonce": "nonce-aaa",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "exit_code": 0,
      "stdout": "",
      "stderr": "",
      "duration_seconds": 0.05
    }
  }
})
```

### Response

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/step2-uuid-2222-2222-222222222222",
    "content": "Set up configuration files.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: echo \"config\" > project/config.json",
    "nonce": "nonce-bbb",
    "shell": {
      "cmd": "echo \"config\" > project/config.json",
      "timeout_seconds": 5
    }
  },
  "next_action": "call kairos_next with kairos://mem/step3-uuid-3333-3333-333333333333 and solution matching challenge",
  "proof_hash": "proof-hash-step1-aaaa"
}
```

The AI executes `echo "config" > project/config.json` (exit code 0). It
notes the top-level `proof_hash` to use as `solution.proof_hash` in the
next call.

## Step 3: next (step 3 of 3 — final)

### Call

```json
kairos_next({
  "uri": "kairos://mem/step3-uuid-3333-3333-333333333333",
  "solution": {
    "type": "shell",
    "nonce": "nonce-bbb",
    "proof_hash": "proof-hash-step1-aaaa",
    "shell": {
      "exit_code": 0,
      "stdout": "",
      "stderr": "",
      "duration_seconds": 0.03
    }
  }
})
```

### Response

```json
{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/step3-uuid-3333-3333-333333333333",
    "content": "Check that everything works.",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: test -f project/config.json",
    "nonce": "nonce-ccc",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "shell": {
      "cmd": "test -f project/config.json",
      "timeout_seconds": 5
    }
  },
  "message": "Protocol steps complete. Call kairos_attest to finalize.",
  "next_action": "call kairos_attest with kairos://mem/step3-uuid-3333-3333-333333333333 and outcome (success or failure) and message to complete the protocol",
  "proof_hash": "proof-hash-step2-bbbb"
}
```

The `next_action` directs the AI to call `kairos_attest`. The AI calls
`kairos_attest(uri, outcome, message)`. After attestation the protocol
run is complete.

## Step 4: attest

### Call

```json
kairos_attest({
  "uri": "kairos://mem/step3-uuid-3333-3333-333333333333",
  "outcome": "success",
  "message": "All 3 steps completed. Project structure created and verified."
})
```

After attestation the AI may respond to the user. See
[kairos_attest workflow](workflow-kairos-attest.md) for the response
schema.

## Flow summary

```
search("simple setup protocol")
  -> must_obey: true
  -> choices[0].next_action: "call kairos_begin with kairos://mem/step1..."
    |
begin("kairos://mem/step1...")
  -> must_obey: true
  -> next_action: "call kairos_next with kairos://mem/step2..."
    |
next("kairos://mem/step2...", solution: {shell, proof_hash: "genesis..."})
  -> must_obey: true
  -> next_action: "call kairos_next with kairos://mem/step3..."
  -> proof_hash: "hash-step1"  (use as solution.proof_hash next)
    |
next("kairos://mem/step3...", solution: {shell, proof_hash: "hash-step1"})
  -> must_obey: true
  -> next_action: "call kairos_attest with ..."
  -> message: "Protocol steps complete. Call kairos_attest to finalize."
    |
attest("kairos://mem/step3...", outcome: "success", message: "...")
  -> run complete; AI responds to user
```

Two fields drive all decisions in the flow:

- `must_obey: true` → follow `next_action`
- `must_obey: false` → use judgment (only after max retries exceeded)

For multiple search matches, the AI picks one choice and follows its
`next_action` (for example, `kairos_begin` for a match, or `kairos_begin`
with the creation URI for create). The rest of the flow is unchanged.

## See also

- [kairos_search workflow](workflow-kairos-search.md)
- [kairos_begin workflow](workflow-kairos-begin.md)
- [kairos_next workflow](workflow-kairos-next.md)
- [kairos_attest workflow](workflow-kairos-attest.md)
