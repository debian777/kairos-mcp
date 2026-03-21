Export an **adapter** or a single **layer** for backup, inspection, or training pipelines.

**Input**

- `uri` — `kairos://adapter/{uuid}` or `kairos://layer/{uuid}` (optional `execution_id` on layer URIs where applicable).
- `format` (optional) — `markdown` (default), `trace_jsonl`, `sft_jsonl`, or `preference_jsonl`.
- `include_reward` (optional, default true) — include reward fields when serializing traces.

**Output:** `content` (string), `content_type`, `format`, optional `item_count`, adapter metadata.

**Markdown format:** Serialized docs use adapter-oriented naming (e.g. `contract` in JSON, **Activation Patterns** / **Reward Signal** headings where applicable).

**Use with `tune`:** Edit exported markdown, then **`tune`** with matching `uris` / `markdown_doc` to apply changes.
