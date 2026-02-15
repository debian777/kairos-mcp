# KAIROS Workflow After Phase 2

This document describes the workflow **after Phase 2** of the Simplify KAIROS Teaching Stack plan. The flow (search → begin → next → attest) is unchanged from Phase 1; structural proof improvements and optional MCP Elicitation are added.

---

## What Phase 2 added

1. **Nonce in challenges:** Each step challenge now includes a server-generated `nonce` (stored in Redis, 1h TTL). The client must echo it in the solution.
2. **genesis_hash in challenges:** Every challenge includes `genesis_hash` (SHA-256 of `"genesis"`). For **step 1**, the client must set `solution.previousProofHash` to this value.
3. **previousProofHash in solutions:** For **step 1**, use `challenge.genesis_hash` as `solution.previousProofHash`. For **step 2+**, use the stored hash of the **previous** step’s accepted proof (the backend validates this; clients receive the chain via the protocol).
4. **Hash chain:** When a proof is accepted, the backend hashes the proof record and stores it. The next step’s solution must reference that hash as `previousProofHash`. This makes skipping or reordering steps detectable.
5. **MCP Elicitation for user_input:** If the client declares `elicitation` capability, the server can send an `elicitation/create` request for `user_input` steps and get confirmation directly from the user (e.g. approve/reject). If not supported, the AI continues to relay `user_input` solutions as before.

---

## Workflow (unchanged structure)

Same as Phase 1: **kairos_search** → **kairos_begin** → **kairos_next** (loop) → **kairos_attest**. The only API changes are in the **shape** of challenges and solutions (nonce, genesis_hash, previousProofHash).

---

## Challenge shape after Phase 2

Every challenge now includes:

- **genesis_hash** (string): SHA-256 hex of the literal `"genesis"`; fixed server constant. Use as `solution.previousProofHash` for step 1.
- **nonce** (string, when step has a memory UUID): One-time value per step; echo in `solution.nonce`.

Type-specific fields (shell, mcp, user_input, comment) are unchanged.

---

## Solution shape after Phase 2

Every solution must include:

- **nonce** (string): Copy from `challenge.nonce` for the current step.
- **previousProofHash** (string): For step 1 use `challenge.genesis_hash`; for step 2+ use the previous step’s proof hash from the server (see below).

Plus the same type-specific payload as before (shell, mcp, user_input, comment).

---

## Generating hashes (for AI / remote)

You do **not** need to compute hashes in normal flow:

- **Step 1:** Use `challenge.genesis_hash` from the current step as `solution.previousProofHash`.
- **Step 2+:** Use `last_proof_hash` from the **previous** `kairos_next` response as `solution.previousProofHash`.

If you ever need to compute SHA-256 yourself (e.g. in a script, or when Node is not available):

- **Mac:** `echo -n 'content' | shasum -a 256 | awk '{print $1}'`
- **Linux:** `echo -n 'content' | sha256sum | awk '{print $1}'`

Example (genesis): `echo -n 'genesis' | shasum -a 256 | awk '{print $1}'` → `aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e`

---

## Challenge / solution examples (Phase 2)

All examples below include `nonce` and `previousProofHash`. For step 1, `previousProofHash` is always `challenge.genesis_hash`. For step 2+, the client must have obtained the previous step’s proof hash (e.g. from a prior successful response or protocol contract).

---

### 1. Shell

**Challenge (example, step 1):**

```json
{
  "type": "shell",
  "description": "Execute shell command: mkdir -p src",
  "shell": { "cmd": "mkdir -p src", "timeout_seconds": 30 },
  "genesis_hash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "nonce": "a1b2c3d4e5f6789012345678abcdef01"
}
```

**Solution (step 1 — previousProofHash = genesis_hash):**

```json
{
  "type": "shell",
  "nonce": "a1b2c3d4e5f6789012345678abcdef01",
  "previousProofHash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "shell": {
    "exit_code": 0,
    "stdout": "",
    "stderr": "",
    "duration_seconds": 0.1
  }
}
```

**Solution (step 2 — previousProofHash = hash of step 1’s proof):**

```json
{
  "type": "shell",
  "nonce": "b2c3d4e5f6789012345678abcdef0123",
  "previousProofHash": "f6e5d4c3b2a10987654321fedcba0987654321fedcba0987654321fedcba09",
  "shell": {
    "exit_code": 0,
    "stdout": "done",
    "stderr": "",
    "duration_seconds": 0.2
  }
}
```

---

### 2. MCP

**Challenge (example):**

```json
{
  "type": "mcp",
  "description": "Call MCP tool: my_tool_name",
  "mcp": { "tool_name": "my_tool_name", "expected_result": null },
  "genesis_hash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "nonce": "c3d4e5f6789012345678abcdef012345"
}
```

**Solution:**

```json
{
  "type": "mcp",
  "nonce": "c3d4e5f6789012345678abcdef012345",
  "previousProofHash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "mcp": {
    "tool_name": "my_tool_name",
    "arguments": { "param": "value" },
    "result": { "ok": true },
    "success": true
  }
}
```

---

### 3. User input

**Challenge (example):**

```json
{
  "type": "user_input",
  "description": "User confirmation: Approve deployment?",
  "user_input": { "prompt": "Approve deployment?" },
  "genesis_hash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "nonce": "d4e5f6789012345678abcdef01234567"
}
```

**Option A — AI-relayed (no elicitation or client sent confirmation):**

```json
{
  "type": "user_input",
  "nonce": "d4e5f6789012345678abcdef01234567",
  "previousProofHash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "user_input": {
    "confirmation": "approved",
    "timestamp": "2025-02-13T12:00:00.000Z"
  }
}
```

**Option B — MCP Elicitation:** If the client supports elicitation, the server may send `elicitation/create` with a form (e.g. `confirmation`: `approved` | `rejected`). The user’s response is then turned into the same solution shape (confirmation + timestamp). The AI does not fabricate the string; the client returns it from the user.

---

### 4. Comment

**Challenge (example):**

```json
{
  "type": "comment",
  "description": "Provide a verification comment (minimum 20 characters)",
  "comment": { "min_length": 20 },
  "genesis_hash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "nonce": "e5f6789012345678abcdef0123456789"
}
```

**Solution:**

```json
{
  "type": "comment",
  "nonce": "e5f6789012345678abcdef0123456789",
  "previousProofHash": "a7b33e87b64e0e2f2e26c6f7e8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7",
  "comment": {
    "text": "I reviewed the security checklist and verified the three items: access control, encryption at rest, and audit logging."
  }
}
```

Comment solutions still must pass **length** and **semantic relevance** (Phase 1) and now must include **nonce** and **previousProofHash** (Phase 2).

---

## Validation rules (Phase 2)

| Check              | When                         | Failure message / behavior                                                                                          |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Nonce match        | Step has stored nonce        | "Nonce mismatch. Use the nonce from the current step challenge."                                                    |
| previousProofHash  | Always (expected hash set)   | "previousProofHash mismatch..." or "Include previousProofHash in solution (use challenge.genesis_hash for step 1)." |
| Type + payload     | As before                    | Type-specific blocked message                                                                                       |
| Comment length     | type === 'comment'           | "Comment must be at least N characters"                                                                             |
| Comment similarity | type === 'comment' (Phase 1) | "Comment does not appear relevant to this step..."                                                                  |

---

## Summary (Phase 2)

| Field               | Challenge             | Solution                                                                   |
| ------------------- | --------------------- | -------------------------------------------------------------------------- |
| genesis_hash        | ✅ always             | — (use as previousProofHash for step 1)                                    |
| nonce               | ✅ when step has UUID | ✅ required when challenge has nonce                                       |
| previousProofHash   | —                     | ✅ required (genesis_hash for step 1; prior step’s proof hash for step 2+) |
| type + type payload | ✅                    | ✅ (shell / mcp / user_input / comment)                                    |

All four challenge types (shell, mcp, user_input, comment) use the same nonce and previousProofHash rules. user_input can additionally be satisfied via MCP Elicitation when the client supports it.
