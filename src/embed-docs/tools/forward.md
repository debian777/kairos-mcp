Run an **adapter** layer by layer.

First call (start a run):

```json
{ "uri": "kairos://adapter/<slug>" }
```

Copy this from `activate.choices[].forward_first_call.uri`. Adapter URIs are
slug-only on the wire.

Continuation call:

```json
{
  "uri": "kairos://layer/<uuid>?execution_id=<uuid>",
  "solution": {
    "type": "<contract.type>",
    "<type-specific>": {},
    "nonce": "<contract.nonce when present>",
    "proof_hash": "<contract.proof_hash when present>"
  }
}
```

Copy `forward.next_call.args` from the previous response, then fill the
`solution.<type>` payload. Layer URIs are UUID-only; never substitute a slug
for a layer URI.

Output always includes:

- `contract` for the current layer
- `next_action` prose guidance
- `next_call` (authoritative machine-readable next call)

`next_call.kind` is:

- `forward` on non-terminal layers
- `reward` on terminal layers
