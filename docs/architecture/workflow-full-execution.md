# Full execution workflow: search to attest

End-to-end walkthrough of a complete KAIROS protocol execution. Shows the
raw JSON call and response at every step. The search response uses per-choice
`next_action`; the AI picks one choice and follows that choice's `next_action`.
The run is complete after the AI calls kairos_attest when directed by the last
kairos_next (or kairos_begin for a single-step protocol).

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

**AI reads global `next_action`** — follow the choice's next_action. The single
choice's `next_action` says to call `kairos_begin` with the given URI. **AI
calls `kairos_begin`** with that URI.

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

**AI reads `next_action`** — URI for the next step is
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

**AI reads `next_action`** — URI for the next step is
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
  "next_action": "call kairos_attest with kairos://mem/step3-uuid-3333-3333-333333333333 and outcome (success or failure) and message to complete the protocol",
  "message": "Protocol steps complete. Call kairos_attest to finalize.",
  "proof_hash": "proof-hash-step2-bbbb"
}
```

**AI reads `next_action`** — call kairos_attest with the last step URI. The AI calls kairos_attest(uri, outcome, message). **After attestation, protocol is done.** The AI may
now respond to the user. Quality was already updated in `kairos_next`; no
attest step.

---

## Flow summary

```
search("simple setup protocol")
  -> must_obey: true, next_action: "Follow the choice's next_action."
  -> choices[0].next_action: "call kairos_begin with kairos://mem/step1..."
    |
begin("kairos://mem/step1...")
  -> must_obey: true, next_action: "call kairos_next with kairos://mem/step2..."
    |
next("kairos://mem/step2...", solution: {shell, proof_hash: "genesis..."})
  -> must_obey: true, next_action: "call kairos_next with kairos://mem/step3..."
  -> proof_hash: "hash-step1" (use as solution.proof_hash next)
    |
next("kairos://mem/step3...", solution: {shell, proof_hash: "hash-step1"})
  -> must_obey: true, next_action: "call kairos_attest with ...", message: "Protocol steps complete. Call kairos_attest to finalize."
  -> proof_hash: "hash-step2"
    |
AI responds to user. (No attest — quality was updated in kairos_next.)
```

After **search**, the AI picks one choice and follows **that choice's
`next_action`**. For a single match that is `kairos_begin` with the match URI.
If the search had returned multiple choices (or refine/create), the AI would
pick one and follow its `next_action` (e.g. `kairos_begin` for a match,
`kairos_search` for refine, `kairos_begin` for create).

The rest of the flow is unchanged: the AI navigates by reading `next_action` at
each step. Two fields drive all decisions:

- `must_obey: true` -> follow `next_action`
- `must_obey: false` -> use judgment (only after max retries exceeded)
