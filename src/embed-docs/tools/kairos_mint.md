Stores markdown documents as KAIROS memories with automatic header-based organization. Each H1 defines a protocol chain; each H2 defines a step.

**When to call:** When the user wants to create, add, mint, store, or save a protocol or document.

**Workflow docs (H1 + H2):** When you create or detect a document that is a workflow (one H1 title, multiple H2 steps), add **challenges** to steps so the protocol is executable. Place a single line at the end of an H2 section, e.g. `PROOF OF WORK: ...`. Choose the type that fits the step; mix types as needed.

**Challenge syntax (use as needed per step):**

- **Shell** — step requires running a command: `PROOF OF WORK: timeout 30s <command>` or `PROOF OF WORK: <command>`
- **Comment** — step requires a short verification (e.g. review, summary): `PROOF OF WORK: comment min_length=20` (or 30, 50)
- **User input** — step requires human confirmation: `PROOF OF WORK: user_input "Confirm ..."` (e.g. "Approve deployment?", "Type yes to continue")
- **MCP** — step requires calling an MCP tool: `PROOF OF WORK: mcp <tool_name>`

You don’t need to add a challenge to every step; only where proof of completion makes sense. For creative or knowledge-work steps, prefer `comment` with a fitting min_length. For approvals, use `user_input`. For commands or tool calls, use `shell` or `mcp`. Optional: read resource `kairos://doc/building-kairos-workflows` for more examples and structure details.

**Input:** `markdown_doc` (string), `llm_model_id` (required), `force_update` (optional, overwrite existing chain with same label).

**Response:** Chain head URI(s). You can then find the protocol via `kairos_search` with a query matching the content.
