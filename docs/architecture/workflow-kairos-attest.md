# kairos_attest workflow

Finalize protocol execution with an outcome. Updates quality metrics in
Qdrant. No `final_solution` required -- the last step's solution was
already validated via `kairos_next`. Quality is updated per step in
`kairos_next`; attest is **optional** and can override outcome or add a
final message after the run is complete.

## Input schema

```json
{
  "uri": "kairos://mem/<uuid>",
  "outcome": "<success|failure>",
  "message": "<string>"
}
```

Fields:

- `uri` -- the URI of the last step in the protocol
- `outcome` -- `"success"` or `"failure"`
- `message` -- short summary of how the protocol went

Fields that no longer exist:

- `final_solution` -- removed; the last step's challenge is solved via
  `kairos_next` like every other step. `kairos_attest` is just a stamp
  of completion, not a challenge/solution gate.

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

- `results` -- array of rating outcomes (one per URI attested)
- `total_rated` -- count of successfully rated URIs
- `total_failed` -- count of failed ratings

---

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

After attestation, the protocol is done. The AI may now respond to the user.

---

## Scenario 2: failure attestation

The protocol failed (e.g., max retries exceeded, or the AI decided to
abort). Quality metrics are penalized.

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

After failure attestation, the protocol is done. The AI should inform the
user about what went wrong.

---

## Validation rules

1. `results` is always a non-empty array.
2. Each result has `uri`, `outcome`, `quality_bonus`, `message`, `rated_at`.
3. `total_rated` + `total_failed` equals `results.length`.
4. `rated_at` is a valid ISO 8601 timestamp.
5. The following fields must NOT be present in the input: `final_solution`.
