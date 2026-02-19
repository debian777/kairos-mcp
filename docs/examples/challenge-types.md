# KAIROS challenge types — mintable examples

The documents in this folder are **real markdown protocols ready for minting**. Each has one H1 (protocol title), one or more H2 steps, and a trailing ` ```json ` block per step with `{"challenge": { ... }}`. Copy the contents of any example into a file and pass it to `kairos_mint` (with `llm_model_id` and optional `force_update`).

## Mintable protocol documents

| File | Challenge type(s) | Description |
|------|------------------|-------------|
| [protocol-example-shell.md](protocol-example-shell.md) | shell | One step: run a command (e.g. `npm test`). |
| [protocol-example-user-input.md](protocol-example-user-input.md) | user_input | One step: get human confirmation. |
| [protocol-example-comment.md](protocol-example-comment.md) | comment | One step: provide a text summary (min length). |
| [protocol-example-mcp.md](protocol-example-mcp.md) | mcp | One step: call an MCP tool and report success. |
| [protocol-example-all-types.md](protocol-example-all-types.md) | shell, mcp, user_input, comment | Four steps, one per type. |

## How to mint

1. Copy the full content of one of the protocol files above (or combine steps into your own document).
2. Ensure each step ends with a single ` ```json ` block containing an object with a `challenge` key (see the examples).
3. Call `kairos_mint` with `markdown_doc`, `llm_model_id`, and optionally `force_update: true`.

## Solution shapes (for kairos_next)

When the server returns a challenge, the agent submits a solution in `kairos_next`. The solution must match the challenge type.

| Type | Solution shape | Pass condition |
|------|----------------|----------------|
| **shell** | `type: "shell"`, `shell: { exit_code, stdout?, stderr?, duration_seconds? }` | `exit_code === 0` |
| **mcp** | `type: "mcp"`, `mcp: { tool_name, result, success, arguments? }` | `success === true` |
| **user_input** | `type: "user_input"`, `user_input: { confirmation, timestamp? }` | Agent supplies confirmation from user |
| **comment** | `type: "comment"`, `comment: { text }` | `text.length` ≥ challenge `min_length` (and optional semantic check) |

Always echo `nonce` and `proof_hash` from the challenge (or previous response) when present; the server generates them.
