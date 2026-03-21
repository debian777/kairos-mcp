# reward workflow

> **Current MCP tool:** **`reward`**. Finalizes an adapter run on the **final
> layer** URI. See [`reward.md`](../../src/embed-docs/tools/reward.md).

**`reward`** runs after **`forward`** has validated the last layer’s contract
and **`next_action`** tells you to finalize. It records outcome (and optional
evaluator fields) and completes the run.

## Input schema

```json
{
  "uri": "kairos://layer/ccc33333-3333-3333-3333-333333333333?execution_id=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "outcome": "success",
  "message": "<non-empty summary>",
  "score": 0.95,
  "feedback": "<optional evaluator note>",
  "rater": "<optional>",
  "rubric_version": "<optional>",
  "llm_model_id": "<optional>"
}
```

Fields:

- **`uri`** — **layer** URI from **`forward`** (include **`?execution_id=`**
  when the run used it). Do not substitute an adapter URI unless the tool
  description explicitly allows it.
- **`outcome`** — **`success`** or **`failure`**.
- **`message`** — short summary (required).
- **`score`**, **`feedback`**, **`rater`**, **`rubric_version`**, **`llm_model_id`**
  — optional evaluator metadata per schema.

## Response schema

```json
{
  "results": [
    {
      "uri": "kairos://layer/ccc33333-3333-3333-3333-333333333333?execution_id=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "outcome": "success",
      "score": 0.95,
      "feedback": null,
      "rater": null,
      "rubric_version": null,
      "rated_at": "2026-02-16T10:30:00.000Z"
    }
  ],
  "total_rated": 1,
  "total_failed": 0
}
```

## Scenario: success

After **`reward`**, the run is complete; you may answer the end user.

## Scenario: failure

Use **`outcome: "failure"`** and explain what went wrong in **`message`**.

## Validation rules

1. **`results`** is non-empty when the call succeeds.
2. **`total_rated`** + **`total_failed`** matches the result rows.
3. **`rated_at`** is ISO 8601.

## See also

- [forward (subsequent calls)](workflow-kairos-next.md)
- [Full execution workflow](workflow-full-execution.md)
- [Search query architecture](search-query.md) — ranking may use success /
  failure signals on stored adapters.
- [Quality metadata](quality-metadata.md)
