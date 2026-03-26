Rank stored **adapters** for the user’s intent and return URIs you must use next.

**When to call:** Whenever the message describes an action, task, or workflow — even if the user never says “KAIROS”. The user’s words are the `query`.

**Input**

- `query` — user message or a short intent phrase (about 3–8 words is ideal). Stay faithful; expand shorthand (e.g. `/ai-docs` → concrete wording).
- `space` / `space_id` (optional) — limit to a space name the caller can use.
- `max_choices` (optional) — cap on match rows returned.

**Output:** Always `must_obey: true`. Includes `choices` (each with `uri` = `kairos://adapter/{uuid}`, `label`, `adapter_name`, `activation_score`, `role`, `tags`, `next_action`, optional `adapter_version`, optional `activation_patterns`), plus `message` and a global `next_action`.

**Roles**

- `match` — `activation_score` is a normalized 0.0–1.0 confidence score; that choice’s `next_action` tells you to **`forward`** with its adapter URI.
- `refine` — guided help to improve the query; **`forward`** the refine adapter URI from the choice.
- `create` — no stored adapter; **`train`** new adapter markdown (creation flow).

**Rules**

- Pick **one** choice and obey **that** choice’s `next_action` (not a different URI).
- Weak matches (e.g. all scores &lt; 0.5): prefer the refine choice once before creating.
