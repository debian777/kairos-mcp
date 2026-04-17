Rank stored **adapters** for the user’s intent and return URIs you must use next.

**When to call:** Whenever the message describes an action, task, or workflow —
even if the user never says "KAIROS". Always pass a short `query` summary.

**Input**

- `query` — required short intent summary (about 3-8 words).
- `space` / `space_id` (optional) — narrow search to one space: `"personal"`, a
  full group path such as `"{{KAIROS_GROUP_SPACE_PATH_EXAMPLE}}"` (optional `"Group: "`
  prefix), or your raw `space_id` (same forms as **`train`** / **`tune`** `space`).
- `max_choices` (optional) — cap on match rows returned.

**Output:** Always `must_obey: true`. Includes `choices` (each with `uri` = `kairos://adapter/{uuid}`, `label`, `adapter_name`, `activation_score`, `role`, `tags`, `next_action`, optional `adapter_version`, optional `activation_patterns`, for **`match`** rows `space_name` — where the adapter is stored, e.g. `Personal`, `Group: …`, `Kairos app`; `null` for refine/create — and `slug` — stored routing slug when present so you can **`forward`** with `kairos://adapter/{slug}`; `null` for refine/create or when the adapter has no slug), plus `message`, a global `next_action`, optional `kairos_work_dir` (canonical path: export as `KAIROS_WORK_DIR` before running shell challenges that reference it), and optional host metadata.

When several spaces contain similar adapters, the server prefers your **default write space** (usually **Personal**) on ties so a personal copy can override a group template.

**Roles**

- `match` — `activation_score` is a normalized 0.0–1.0 confidence score; that choice’s `next_action` tells you to **`forward`** with its adapter URI.
- `refine` — guided help to improve the query; **`forward`** the refine adapter URI from the choice.
- `create` — no stored adapter matched; **`train`** new adapter markdown (adapter/workflow creation flow).

**Rules**

- Pick **one** choice and obey **that** choice’s `next_action` (not a different URI).
- Weak matches (e.g. all scores &lt; 0.5): prefer the refine choice once before creating.
