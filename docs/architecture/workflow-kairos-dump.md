# kairos_dump workflow

Read-only inspection of a memory or full protocol. Returns **markdown_doc**
so the agent can feed it to `kairos_update` (single step) or `kairos_mint`
(full protocol). No run state, no nonce, no `next_action` or `must_obey`.
Use after `kairos_search` when you have a URI and need to read content
before updating or re-minting.

## Input schema

```json
{
  "uri": "kairos://mem/<uuid>",
  "protocol": false
}
```

Fields:

- `uri` — any memory URI (step or chain head).
- `protocol` — optional, default `false`. When `true`, resolve to the
  parent chain and return the full protocol as one markdown document.

## Response schema (both modes)

Every response includes **markdown_doc** (string), ready to pass to
`kairos_update` or `kairos_mint`. Optional context fields vary by mode.

### Default mode (`protocol: false`)

```json
{
  "markdown_doc": "<string>",
  "uri": "kairos://mem/<uuid>",
  "label": "<string>",
  "chain_label": "<string or null>",
  "position": { "step_index": 1, "step_count": 3 },
  "challenge": { "type": "shell", "description": "...", "shell": { "cmd": "...", "timeout_seconds": 30 } }
}
```

- **markdown_doc** — the step’s stored content (payload `text`). **Target behavior:** build from payload `text` and serialize
  `payload.proof_of_work` as a fenced ` ```json ` block at the end (see
  workflow-kairos-mint). Use this
  value in `kairos_update({ uris: [uri], markdown_doc: [markdown_doc] })`
  after editing.
- **uri** — the requested memory URI.
- **label** — step or node label (same shape as search choice).
- **chain_label** — protocol title when this memory is part of a chain;
  `null` for standalone memories. Aligns with `kairos_search` choices.
- **position** — optional; step_index and step_count when the memory is
  part of a chain. Omitted for chain heads or single memories.
- **challenge** — optional; structured challenge from payload
  `proof_of_work`, for UI or agent reasoning. Same shape as
  `kairos_begin`/`kairos_next` challenge (without nonce/proof_hash).

### Protocol mode (`protocol: true`)

```json
{
  "markdown_doc": "<string>",
  "uri": "kairos://mem/<uuid>",
  "label": "<string>",
  "chain_label": "<string>",
  "step_count": 3
}
```

- **markdown_doc** — full protocol: `# {chain.label}\n\n` plus each step as
  `## {label}\n\n{text}\n\n` and a fenced ` ```json ` block with
  `{"challenge":...}` at the end of each step. Same format `kairos_mint`
  accepts. Use in `kairos_mint({ markdown_doc, llm_model_id, force_update: true })`
  after comparing or editing.
- **uri** — chain head URI (first step), even if the input URI was a
  later step.
- **label** — chain label (protocol title); same as `chain_label` in this mode.
- **chain_label** — protocol title (same as `label`). Aligns with
  `kairos_search` choices.
- **step_count** — number of steps in the protocol.

---

## Scenario 1: dump single step (for update)

The agent has a step URI and wants to edit it, then call `kairos_update`.

### Input

```json
{
  "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
  "protocol": false
}
```

### Expected output

Example `markdown_doc` value (actual payload is this content with newlines as
`\n` in JSON):

````
Set up configuration files.

```json
{"challenge":{"type":"shell","shell":{"cmd":"echo config > project/config.json","timeout_seconds":10},"required":true}}
```
````

```json
{
  "markdown_doc": "<see example above>",
  "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
  "label": "Step 2: Configure",
  "chain_label": "Deploy Checklist",
  "position": { "step_index": 2, "step_count": 3 },
  "challenge": {
    "type": "shell",
    "description": "Execute shell command: echo config > project/config.json",
    "shell": { "cmd": "echo config > project/config.json", "timeout_seconds": 10 }
  }
}
```

### AI behavior

Edit `markdown_doc` as needed, then call
`kairos_update({ uris: [uri], markdown_doc: [markdown_doc] })`.

---

## Scenario 2: dump full protocol (for mint dedup)

The agent found a similar protocol (e.g. from `kairos_mint` SIMILAR_MEMORY_FOUND
or from search) and wants to compare or replace it.

### Input

```json
{
  "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
  "protocol": true
}
```

### Expected output

Example `markdown_doc` value (actual payload is this content with newlines as
`\n` in JSON):

````
# Deploy Checklist

## Step 1: Build

Run tests.

```json
{"challenge":{"type":"shell","shell":{"cmd":"npm test","timeout_seconds":60},"required":true}}
```

## Step 2: Deploy

Deploy to staging.

```json
{"challenge":{"type":"comment","comment":{"min_length":20},"required":true}}
```
````

```json
{
  "markdown_doc": "<see example above>",
  "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
  "label": "Deploy Checklist",
  "chain_label": "Deploy Checklist",
  "step_count": 2
}
```

### AI behavior

Compare `markdown_doc` with the intended new protocol. Then either call
`kairos_mint({ markdown_doc: edited, llm_model_id, force_update: true })`
to replace, or change title/content and mint as a distinct protocol.

---

## Scenario 3: invalid or missing URI

The URI does not exist or is malformed.

### Expected output

Structured error (e.g. 404 or invalid request) with a clear message. No
`markdown_doc` in the response.

### AI behavior

Do not call `kairos_update` or `kairos_mint` with the result. Inform the
user or resolve the URI (e.g. via `kairos_search`) and retry.

---

## Validation rules

1. `markdown_doc` is always present on success and is a non-empty string.
2. Default mode: `uri`, `label`, and `chain_label` (or null) present;
   `position` and `challenge` optional depending on payload.
3. Protocol mode: `uri` (chain head), `label`, `chain_label`, and
   `step_count` present.
4. Dump does not create run state, issue nonces, or return `next_action` or
   `must_obey`.

---

## Relationship to other tools

- **kairos_search** — use to obtain URIs; then use dump to read content.
- **kairos_begin** — starts execution and issues a challenge; use dump when
  you need to inspect or edit without starting a run.
- **kairos_update** — accepts `markdown_doc` array; single-step dump
  returns the string for one URI.
- **kairos_mint** — accepts `markdown_doc` string; protocol-mode dump
  returns the full document for re-mint or comparison.
