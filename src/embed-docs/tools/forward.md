Run an **adapter** layer-by-layer. Each layer exposes a **contract** (what to
satisfy) and accepts a **solution**.

**URI**

Use these URIs to start or continue a run.

- `kairos://adapter/{uuid}` or `kairos://adapter/{slug}` — start a **new**
  execution (server assigns `execution_id`). Slug adapter URIs resolve to the
  adapter entry layer before execution starts. If several adapters share the same
  slug, the server picks one deterministically (default write space preferred)
  and may set **`slug_disambiguation_note`** on the response — prefer an explicit
  `kairos://adapter/{uuid}` when you see it.
- `kairos://layer/{uuid}` or `kairos://layer/{uuid}?execution_id={uuid}` —
  continue the same run; reuse `execution_id` from the last response when the
  layer URI includes it.

**Input**

Provide the URI and, for continuation calls, a matching solution.

- `uri` — adapter or layer URI as above.
- `solution` — omit on the **first** call of a run (adapter URI, or layer URI
  **without** `?execution_id=...`) to load the current layer and contract.
  **Do not** send `solution` on that start call, and do not send an empty
  `solution` object. For continuation calls in that same execution chain (layer
  URI with `?execution_id=...`), include `solution.type`, the matching payload
  object (for example, `solution.shell`), and echo `nonce` / `proof_hash` when
  the contract provides them.

**Output**

The tool returns `must_obey`, `current_layer` (markdown body), `contract`
(includes `type`: `tensor` | `shell` | `mcp` | `user_input` | `comment`; for
proof layers, echo server `nonce` / `proof_hash` in the solution when present),
optional `tensor_in`, `next_action`, optional `execution_id`, `proof_hash`,
optional `slug_disambiguation_note` when a slug URI matched multiple adapters,
optional `activation_space_name`, `context_adapter_name`, `current_layer_label`,
`adapter_layer_index`, `adapter_layer_count` (widget progress), and error fields
on retry paths.

**Flow**

Follow these steps in order.

1. **`activate`** → pick adapter URI → **`forward`** with adapter URI and **no**
   `solution`.
2. Read `contract` and `next_action`. Complete the work the contract describes.
3. **`forward`** again with the **layer** URI from the response (including
   `?execution_id=...`) and a matching `solution` (`solution.type` plus payload).
   Example for a comment layer:

   ```json
   {
     "uri": "kairos://layer/00000000-0000-0000-0000-000000000002?execution_id=00000000-0000-0000-0000-000000000003",
     "solution": {
       "type": "comment",
       "comment": "<verification text — prefer a plain string>",
       "nonce": "<echo from contract when present>",
       "proof_hash": "<echo from contract when present>"
     }
   }
   ```

4. Repeat until `next_action` directs you to **`reward`** on the final layer URI.

**Tensor contracts:** supply `solution.tensor` matching
`contract.tensor.output.name` and type constraints; prior tensor outputs may be
merged per `tensor_in`.

**Comment contracts (`contract.type` is `comment`):** prefer `solution.comment` as
a **plain string** (the verification text). The object form
`{ "text": "<verification text>" }` remains accepted for compatibility with older
clients. The string must meet `contract.comment.min_length` when that constraint
is present.

**MCP contracts (`contract.type` is `mcp`):** supply `solution.mcp` with
`tool_name`, `result`, `success`, and optionally `arguments` (object). The
server checks your submission against the layer contract before accepting the
proof:

- **`contract.mcp.tool_name`** — when present on the contract, `solution.mcp.tool_name` must match **exactly** (case-sensitive).
- **`contract.mcp.arguments`** — when this field is **present** on the contract (including `{}`), you **must** send `solution.mcp.arguments` as a **plain object** (not `null` or an array). Matching is **subset / deep**: every key in the contract object must match the same value in your object (nested objects use the same rule; extra keys on your side are allowed). Arrays must have the same length and each index is compared the same way. If the contract omits `mcp.arguments`, the server does not constrain `solution.mcp.arguments`.
- After those checks, `solution.mcp.success` still determines pass vs fail for the step.

On mismatch, responses may include `error_code` **`MCP_TOOL_MISMATCH`**,
**`MCP_ARGUMENTS_MISMATCH`**, or **`MISSING_FIELD`** (for example missing
`solution.mcp.arguments` when the contract defines `mcp.arguments`).

**MUST ALWAYS:** Echo server-issued `nonce`, `proof_hash`, and URIs exactly.
Follow `next_action` verbatim.

**MUST NEVER:** Invent URIs; skip layers; submit a solution type that does not
match `contract.type`.
