Export an **adapter** or a single **layer** for backup, inspection, or
training pipelines.

**Input**

- `uri` — `kairos://adapter/{uuid}` or `kairos://layer/{uuid}` (optional `execution_id` on layer URIs where applicable).
- `format` (optional) — `markdown` (default), `trace_jsonl`,
  `reward_jsonl`, `sft_jsonl`, or `preference_jsonl`.
- `include_reward` (optional, default true) — include reward fields when
  serializing `trace_jsonl`. `reward_jsonl` always serializes reward data and
  skips unrewarded executions.

**Output:** `content` (string), `content_type`, `format`, optional `item_count`, adapter metadata.

**Markdown format:** Serialized docs use adapter-oriented naming (e.g. `contract` in JSON, **Activation Patterns** / **Reward Signal** headings where applicable).

**Training formats:** `reward_jsonl` emits only rows with stored reward data in
a stable reward-centric shape. `sft_jsonl` and `preference_jsonl` include only
runs whose stored reward metadata clears the export gate. Ungraded rewards stay
in `trace_jsonl` but are excluded from model-training formats.

**RFT gate:** `rft_jsonl` is intentionally not exposed yet. Add it only after
grader reliability and task suitability are proven.

**Use with `tune`:** Edit exported markdown, then **`tune`** with matching `uris` / `markdown_doc` to apply changes.
