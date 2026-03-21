# Building KAIROS adapters (v10)

**Purpose:** Author **adapters** (markdown) and run them with **`train`** →
**`activate`** → **`forward`** (loop) → **`reward`**. Each verifiable
**layer** ends with a fenced JSON block containing a **`contract`**.

---

## Document model

| Markdown | Runtime |
|----------|---------|
| One H1 | One **adapter** (ordered **layers**) |
| H2 sections | Layer labels / narrative |
| Last fenced **json** block in a segment | **Contract** for that layer (stripped from stored text) |
| First H2 after H1 | **Activation Patterns** |
| Last H2 | **Reward Signal** |

**Parsing:** Only the **last** fenced block in a segment is the contract. Open the fence as **json** on its own line at the start of the line. Use **json**-labeled fences only for contracts (unlabeled fences that contain contract JSON are rejected).

---

## Execution flow

1. **`train`** — store `markdown_doc` + `llm_model_id` (optional `space`, `force_update`, `protocol_version`).
2. **`activate`** — semantic match; pick one choice; obey its `next_action` (usually **`forward`** with `kairos://adapter/{uuid}`).
3. **`forward`** — first call with adapter URI and **no** `solution` loads layer + `contract`. Then submit `solution` whose `type` matches `contract.type` until `next_action` points to **`reward`**.
4. **`reward`** — pass the **layer** URI from the final **`forward`** response (`kairos://layer/...`).

**Edit / backup:** **`export`** (markdown or dataset formats) → edit → **`tune`** with `uris` + `markdown_doc`. **`delete`** removes adapters or layers.

---

## Contract types (stored shape)

Contracts mirror **`forward`** / solution pairs.

**`shell`** — run command; solution includes `exit_code`, `stdout`, `stderr`, optional `duration_seconds`.

**`mcp`** — call an MCP tool; solution includes `tool_name`, `arguments`, `result`, `success`.

**`user_input`** — show prompt; solution includes `confirmation` (and optional `timestamp`).

**`comment`** — text meeting `min_length`; solution includes `comment.text`.

**`tensor`** — structured tensor IO per `contract.tensor` (`required_inputs`, `output` schema); solution includes `tensor.name` and `tensor.value`.

Proof-bearing layers: echo server **`nonce`** and **`proof_hash`** in the solution when the contract provides them.

Example (comment layer):

```json
{
  "contract": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

---

## MUST ALWAYS

- Use **Activation Patterns** as first H2 and **Reward Signal** as last H2 (per adapter).
- Put each layer’s contract in a trailing **` ```json `** block with a top-level **`contract`** object.
- Follow **`forward`** `next_action` and obey `must_obey` when false only after retry exhaustion per tool rules.

## MUST NEVER

- Pass URIs not returned by the server.
- Mix plain fenced blocks with contract JSON.
- Submit a solution type that does not match `contract.type`.

---

## Quick reference

| Goal | Tool |
|------|------|
| Store adapter | `train` |
| Find adapter | `activate` |
| Run layers | `forward` |
| Finalize run | `reward` |
| Edit | `tune` |
| Dump | `export` |
| Remove | `delete` |
| List spaces | `spaces` |
