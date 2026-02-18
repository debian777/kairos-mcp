# Full execution workflow: search to run complete

End-to-end walkthrough of a complete KAIROS protocol execution. Shows the
raw JSON call and response at every step. Demonstrates how `next_action`
chains the entire flow. The run is complete when `next_action` says "Run complete." (no attest step).

---

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

---

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
  "next_action": "call kairos_begin with kairos://mem/step1-uuid-1111-1111-111111111111 to execute protocol",
  "choices": [
    {
      "uri": "kairos://mem/step1-uuid-1111-1111-111111111111",
      "label": "Initialize / Configure / Verify",
      "chain_label": "Simple Setup Protocol",
      "score": 1.0,
      "role": "match",
      "tags": ["setup", "project", "simple"]
    }
  ]
}
```

**AI reads `next_action`** and calls `kairos_begin`.

---

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
    "content": "Create the project directory structure.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"mkdir -p project/src\",\"timeout_seconds\":10},\"required\":true}}\n```",
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

**AI executes** `mkdir -p project/src` (exit code 0).

**AI reads `next_action`** -- URI for the next step is
`kairos://mem/step2-uuid-2222-2222-222222222222`.

---

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
    "content": "Set up configuration files.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"echo \\\"config\\\" > project/config.json\",\"timeout_seconds\":5},\"required\":true}}\n```",
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

**AI executes** `echo "config" > project/config.json` (exit code 0).

**AI reads `next_action`** -- URI for the next step is
`kairos://mem/step3-uuid-3333-3333-333333333333`.

**AI notes** `proof_hash` (top-level) to use as `solution.proof_hash` in
the next call.

---

## Step 3: next (step 3 of 3 -- final)

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
    "content": "Check that everything works.\n\n```json\n{\"challenge\":{\"type\":\"shell\",\"shell\":{\"cmd\":\"test -f project/config.json\",\"timeout_seconds\":5},\"required\":true}}\n```",
    "mimeType": "text/markdown"
  },
  "challenge": {
    "type": "comment",
    "description": "Provide a verification comment describing how you completed this step",
    "nonce": "nonce-ccc",
    "proof_hash": "aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e",
    "comment": {
      "min_length": 20
    }
  },
  "message": "Protocol completed. No further steps.",
  "next_action": "Run complete.",
  "proof_hash": "proof-hash-step2-bbbb"
}
```

**AI reads `next_action`** — "Run complete." **Protocol is done.** The AI may now respond to the user. Quality was already updated in `kairos_next`; no attest step.

---

## Flow summary

```
search("simple setup protocol")
  -> must_obey: true, next_action: "call kairos_begin with kairos://mem/step1..."
    |
begin("kairos://mem/step1...")
  -> must_obey: true, next_action: "call kairos_next with kairos://mem/step2..."
    |
next("kairos://mem/step2...", solution: {shell, proof_hash: "genesis..."})
  -> must_obey: true, next_action: "call kairos_next with kairos://mem/step3..."
  -> proof_hash: "hash-step1" (use as solution.proof_hash next)
    |
next("kairos://mem/step3...", solution: {shell, proof_hash: "hash-step1"})
  -> must_obey: true, next_action: "Run complete.", message: "Protocol completed. No further steps."
  -> proof_hash: "hash-step2"
    |
AI responds to user. (No attest — quality was updated in kairos_next.)
```

The AI navigates the entire flow by reading `next_action` at each step.
Two fields drive all decisions:

- `must_obey: true` -> follow `next_action`
- `must_obey: false` -> use judgment (only after max retries exceeded)
