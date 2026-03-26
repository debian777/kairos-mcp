Finalize an adapter run with an outcome and optional evaluator metadata.

**When:** After **`forward`** reports the last layer is done and `next_action` tells you to call **`reward`**.

**Input**

- `uri` — **`kairos://layer/{uuid}`** (final layer; include `?execution_id=...` when the run used it).
- `outcome` — `success` or `failure`.
- Optional: `score` (0–1), `feedback`, `rater`, `rubric_version`, `llm_model_id`.

**Output:** Per-layer result rows with `rated_at`, normalized grading
metadata (`grader_kind`, `evaluation_label`), and export eligibility
flags plus blocker lists for `sft_jsonl` and `preference_jsonl`.

**Rules:** Use only layer URIs returned by **`forward`**. Do not substitute adapter URIs here unless the tool schema explicitly allows it (this tool expects a layer URI).
