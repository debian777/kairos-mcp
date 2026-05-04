Rank stored **adapters** for the user’s intent and return URIs you must use next.

**When to call:** Whenever the message describes an action, task, or workflow —
even if the user never says "KAIROS". Always pass a short `query` summary.

**Input**

- `query` — required short intent summary (about 3-8 words).
- `space` / `space_id` (optional) — narrow search to one space: `"personal"`, a
  full group path such as `"{{KAIROS_GROUP_SPACE_PATH_EXAMPLE}}"` (optional `"Group: "`
  prefix), or your raw `space_id` (same forms as **`train`** / **`tune`** `space`).
- `max_choices` (optional) — cap on match rows returned.

**Output:** Always `must_obey: true`. Includes `choices` (each with `uri` = `kairos://adapter/{uuid}`, `label`, `adapter_name`, `activation_score`, `role`, `tags`, `next_action`, optional `adapter_version`, optional `activation_patterns`, for **`match`** rows `space_name` — where the adapter is stored, for example `Personal`, `Group: …`, `Kairos app`; `null` for refine/create — and `slug` — stored routing slug when present so you can **`forward`** with `kairos://adapter/{slug}`; `null` for refine/create or when the adapter has no slug), plus `message`, a global `next_action`, optional `kairos_local_artifact_dir`, and optional host metadata.

**`kairos_local_artifact_dir`** — ordered URI hints (preferred first) for the run's local handoff dir (drafts, review outputs, generated files, checksums shared between layers and subagents). Two schemes, both resolved **on your machine**: `project://<rel>` → `<your project root>/<rel>`; `user://<rel>` → `<your home or $XDG_CONFIG_HOME>/<rel>`. Pick `project://` when you have exactly one project context; fall through to `user://` when your session spans multiple projects so artifacts from different projects don't collide. After resolving, `export KAIROS_LOCAL_ARTIFACT_DIR="<absolute>"` for shell challenges (skip if your shell already defines it). The server never resolves these to a path on its own filesystem; the value carries no server paths and is identical for stdio and HTTP transports. Not a shell cwd, not a Docker `WORKDIR`.

When several spaces contain similar adapters, the server prefers your **default write space** (usually **Personal**) on ties so a personal copy can override a group template.

**Roles**

- `match` — `activation_score` is a normalized 0.0–1.0 confidence score; that choice’s `next_action` tells you to **`forward`** with its adapter URI.
- `refine` — guided help to improve the query; **`forward`** the refine adapter URI from the choice.
- `create` — no stored adapter matched; **`train`** new adapter markdown (adapter/workflow creation flow).

**Rules**

- Pick **one** choice and obey **that** choice’s `next_action` (not a different URI).
- Weak matches (e.g. all scores &lt; 0.5): prefer the refine choice once before creating.
