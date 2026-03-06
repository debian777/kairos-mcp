# KAIROS challenge types — mintable examples

The documents in this folder are **real markdown protocols ready for
minting**. Each has one H1 (protocol title), one or more H2 steps, and
a trailing ` ```json ` block per step with `{"challenge": { ... }}`.
Copy the contents of any example and pass it to `kairos_mint` (with
`llm_model_id` and optional `force_update`).

## Mintable protocol documents

| File | Challenge type(s) | Description |
|------|------------------|-------------|
| [protocol-example-shell.md](protocol-example-shell.md) | shell | Step 1: run a command. Step 2: show output to user (no challenge). |
| [protocol-example-user-input.md](protocol-example-user-input.md) | user_input | Step 1: get human confirmation. Step 2: show output to user (no challenge). |
| [protocol-example-comment.md](protocol-example-comment.md) | comment | Step 1: provide a text summary (min length). Step 2: show output to user (no challenge). |
| [protocol-example-mcp.md](protocol-example-mcp.md) | mcp | Step 1: call an MCP tool and report success. Step 2: show output to user (no challenge). |
| [protocol-example-all-types.md](protocol-example-all-types.md) | shell, mcp, user_input, comment | Steps 1–4: one per type. Step 5: show outputs to user (no challenge). |

## How to mint

1. Copy the full content of one of the protocol files above.
2. Verify each step ends with a single ` ```json ` block containing an
   object with a `challenge` key.
3. Call `kairos_mint` with `markdown_doc`, `llm_model_id`, and
   optionally `force_update: true`.

## Solution shapes for `kairos_next`

When the server returns a challenge, submit a solution in `kairos_next`.
The solution type must match the challenge type exactly.

| Type | Solution shape | Pass condition |
|------|----------------|----------------|
| `shell` | `type: "shell"`, `shell: { exit_code, stdout?, stderr?, duration_seconds? }` | `exit_code === 0` |
| `mcp` | `type: "mcp"`, `mcp: { tool_name, result, success, arguments? }` | `success === true` |
| `user_input` | `type: "user_input"`, `user_input: { confirmation, timestamp? }` | Any non-empty `confirmation` from the user |
| `comment` | `type: "comment"`, `comment: { text }` | `text.length` ≥ challenge `min_length` |

Echo `nonce` and `proof_hash` from the challenge (step 1) or previous
response (steps 2+). The server generates them; never compute them.

For agent execution rules (how to perform each challenge type, not
infer or fabricate), see the `kairos_begin` and `kairos_next` tool
descriptions.
