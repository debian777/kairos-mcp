# kairos_attest workflow

`kairos_attest` is the required final step of every protocol run. When the
last `kairos_next` (or `kairos_begin` for a single-step protocol) has no
more content steps, `next_action` always directs the AI to call
`kairos_attest` with the last step URI, an outcome, and a message. Calling
it finalizes the run and updates quality metrics in Qdrant.

No `final_solution` is required — the last step's challenge was already
validated by `kairos_next`.

## Input schema

```json
{
  "uri": "kairos://mem/<uuid>",
  "outcome": "<success|failure>",
  "message": "<string>"
}
```

Fields:

- `uri` — the URI of the last step in the protocol
- `outcome` — `"success"` or `"failure"`
- `message` — short summary of how the protocol went

Fields that no longer exist:

- `final_solution` — removed; the last step's challenge is solved via
  `kairos_next` like every other step. `kairos_attest` is a completion
  stamp, not a challenge/solution gate.

## Response schema

```json
{
  "results": [
    {
      "uri": "kairos://mem/<uuid>",
      "outcome": "<success|failure>",
      "quality_bonus": "<number>",
      "message": "<string>",
      "rated_at": "<ISO timestamp>"
    }
  ],
  "total_rated": "<number>",
  "total_failed": "<number>"
}
```

Fields:

- `results` — array of rating outcomes (one per URI attested)
- `total_rated` — count of successfully rated URIs
- `total_failed` — count of failed ratings

## Scenario 1: success attestation

The protocol completed successfully. Quality metrics are boosted.

### Input

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
  "outcome": "success",
  "message": "All steps completed. Project structure created and verified."
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
      "outcome": "success",
      "quality_bonus": 5,
      "message": "All steps completed. Project structure created and verified.",
      "rated_at": "2026-02-16T10:30:00.000Z"
    }
  ],
  "total_rated": 1,
  "total_failed": 0
}
```

### AI behavior

After attestation the protocol run is complete. The AI may now respond to
the user.

## Scenario 2: failure attestation

The protocol failed (for example, max retries exceeded, or the AI aborted).
Quality metrics are penalized.

### Input

```json
{
  "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
  "outcome": "failure",
  "message": "Step 2 failed: permission denied when creating config file."
}
```

### Expected output

```json
{
  "results": [
    {
      "uri": "kairos://mem/ccc33333-3333-3333-3333-333333333333",
      "outcome": "failure",
      "quality_bonus": -0.2,
      "message": "Step 2 failed: permission denied when creating config file.",
      "rated_at": "2026-02-16T10:35:00.000Z"
    }
  ],
  "total_rated": 1,
  "total_failed": 0
}
```

### AI behavior

After failure attestation the protocol run is complete. The AI informs the
user about what went wrong.

## Validation rules

1. `results` is always a non-empty array.
2. Each result has `uri`, `outcome`, `quality_bonus`, `message`, and
   `rated_at`.
3. `total_rated` + `total_failed` equals `results.length`.
4. `rated_at` is a valid ISO 8601 timestamp.
5. The `final_solution` field must not be present in the input.

## See also

- [kairos_next workflow](workflow-kairos-next.md) — how the last step
  directs the AI to call `kairos_attest`
- [Full execution workflow](workflow-full-execution.md)
- [Quality metadata](quality-metadata.md) — how attestation updates
  quality scores
