# kairos_search workflow

> **Current MCP tool:** **`activate`**. See [`activate.md`](../../src/embed-docs/tools/activate.md). This page keeps the legacy **`kairos_search`** name for reference.

`kairos_search` returns a unified `choices` array for all scenarios. Every
response has `must_obey: true`. Each choice has its own `next_action`.
The `refine` choice (role `refine`) points to a built-in protocol the
agent runs via `kairos_begin` to get step-by-step help improving the
query.

## Unified response schema

```json
{
  "must_obey": true,
  "message": "<string>",
  "next_action": "Pick one choice and follow that choice's next_action.",
  "choices": [
    {
      "uri": "kairos://mem/<uuid>",
      "label": "<string>",
      "chain_label": "<string or null>",
      "score": "<number 0.0-1.0, or null for non-match entries>",
      "role": "match | refine | create",
      "tags": ["<string>"],
      "next_action": "<string>"
    }
  ]
}
```

Fields:

- `must_obey` — always `true`
- `message` — summary (for example, "Found N matches (top confidence:
  X%). Choose one, refine your search, or create a new protocol.")
- `next_action` — global directive: "Pick one choice and follow that
  choice's next_action." Single-match responses may use a shorter
  variant: "Follow the choice's next_action."
- `choices` — array of options; each has:
  - `uri` — protocol URI (`kairos://mem/<uuid>`)
  - `label`, `chain_label`, `score`, `role`, `tags` — unchanged semantics
  - **`next_action`** — the exact instruction for that option:
    - **match:** "call kairos_begin with &lt;uri&gt; to execute this
      protocol"
    - **refine:** "call kairos_begin with
      kairos://mem/00000000-0000-0000-0000-000000002002 to get
      step-by-step help turning the user's request into a better search
      query"
    - **create:** "call kairos_begin with
      kairos://mem/00000000-0000-0000-0000-000000002001 to create a new
      protocol"

Roles:

- `match` — search result with numeric `score` (0.0–1.0)
- `refine` — run the refining-help protocol
  (URI `00000000-0000-0000-0000-000000002002`) via `kairos_begin`;
  `score: null`
- `create` — system action to create a new protocol; `score: null`

**Ordering and count:** Match choices come first (top N), then at most
one `refine` choice, then one `create` choice. Refine and create are not
counted in the search limit. For a limit of 10, the list has up to 10
match choices, then choice 11 = refine, choice 12 = create (12 total).
The match count in `message` counts only search results.

## Scenario 1: single match

One protocol matches. The only choice carries `next_action` to call
`kairos_begin`.

### Input

```json
{
  "query": "coding deploy"
}
```

### Expected output

```json
{
  "must_obey": true,
  "message": "Found 1 match.",
  "next_action": "Follow the choice's next_action.",
  "choices": [
    {
      "uri": "kairos://mem/bd939b2a-b35f-40f2-8dec-7dec74a65116",
      "label": "EXTENSION — NATURAL LANGUAGE → CODING → KAIROS (MANDATORY)",
      "chain_label": "EXTENSION — NATURAL LANGUAGE → CODING → KAIROS (MANDATORY)",
      "score": 0.56,
      "role": "match",
      "tags": ["coding", "deploy", "mandatory"],
      "next_action": "call kairos_begin with kairos://mem/bd939b2a-b35f-40f2-8dec-7dec74a65116 to execute protocol"
    }
  ]
}
```

### AI behavior

1. Read the global `next_action` — follow the choice's `next_action`.
2. Call `kairos_begin` with the URI from the single choice.

## Scenario 2: multiple matches

Several protocols match. Each match has its own `next_action`; refine and
create choices are appended.

### Input

```json
{
  "query": "Jira create ticket"
}
```

### Expected output

```json
{
  "must_obey": true,
  "message": "Found 3 matches (top confidence: 52%). Choose one, refine your search, or create a new protocol.",
  "next_action": "Pick one choice and follow that choice's next_action.",
  "choices": [
    {
      "uri": "kairos://mem/2ab737f0-a9b1-49a0-bb10-5c8105c4f6e8",
      "label": "Core Principles / Discovery & Pattern Analysis",
      "chain_label": "Create Jira Ticket in BIB - Bug",
      "score": 0.52,
      "role": "match",
      "tags": ["jira", "issue", "creator", "bib", "bug"],
      "next_action": "call kairos_begin with kairos://mem/2ab737f0-a9b1-49a0-bb10-5c8105c4f6e8 to execute this protocol"
    },
    {
      "uri": "kairos://mem/5b1d29a7-edc5-4ad1-9938-f50f20143f79",
      "label": "Core Principles / Discovery & Pattern Analysis",
      "chain_label": "Create Jira Ticket in BIB - Story",
      "score": 0.51,
      "role": "match",
      "tags": ["jira", "issue", "creator", "bib", "story"],
      "next_action": "call kairos_begin with kairos://mem/5b1d29a7-edc5-4ad1-9938-f50f20143f79 to execute this protocol"
    },
    {
      "uri": "kairos://mem/80ed2aa7-93da-46f6-88c3-90a8a93a6712",
      "label": "Core Principles / Discovery & Pattern Analysis",
      "chain_label": "Create Jira Ticket in BIB - Task",
      "score": 0.49,
      "role": "match",
      "tags": ["jira", "issue", "creator", "bib", "task"],
      "next_action": "call kairos_begin with kairos://mem/80ed2aa7-93da-46f6-88c3-90a8a93a6712 to execute this protocol"
    },
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002002",
      "label": "Get help refining your search",
      "chain_label": "Run protocol to turn vague user request into a better kairos_search query",
      "score": null,
      "role": "refine",
      "tags": ["meta", "refine"],
      "next_action": "call kairos_begin with kairos://mem/00000000-0000-0000-0000-000000002002 to get step-by-step help turning the user's request into a better search query"
    },
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002001",
      "label": "Create New KAIROS Protocol Chain",
      "chain_label": "Create New KAIROS Protocol Chain",
      "score": null,
      "role": "create",
      "tags": ["meta", "creation"],
      "next_action": "call kairos_begin with kairos://mem/00000000-0000-0000-0000-000000002001 to create a new protocol"
    }
  ]
}
```

### AI behavior

1. Read the global `next_action` — pick one choice and follow it.
2. Use `label`, `chain_label`, `score`, and `tags` to pick the best match
   (for example, Bug vs Story vs Task).
3. If a match fits: follow that choice's `next_action` → call
   `kairos_begin` with that URI.
4. If none fit and the query may need improvement: pick **refine** and
   follow its `next_action`.
5. If the user wants a new protocol: pick **create** and follow its
   `next_action`.

## Scenario 3: weak matches

No strong match (score &lt; 0.5); top scores are modest (for example, 0.38–0.47). Refine
and create remain available.

### Input

```json
{
  "query": "database migration rollback"
}
```

### Expected output

```json
{
  "must_obey": true,
  "message": "Found 2 matches (top confidence: 47%). Choose one, refine your search, or create a new protocol.",
  "next_action": "Pick one choice and follow that choice's next_action.",
  "choices": [
    {
      "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
      "label": "Database Operations / Migration Steps",
      "chain_label": "Database Migration Workflow",
      "score": 0.47,
      "role": "match",
      "tags": ["database", "migration", "ops"],
      "next_action": "call kairos_begin with kairos://mem/aaa11111-1111-1111-1111-111111111111 to execute this protocol"
    },
    {
      "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
      "label": "Rollback Procedures",
      "chain_label": "Emergency Rollback Protocol",
      "score": 0.38,
      "role": "match",
      "tags": ["rollback", "emergency", "ops"],
      "next_action": "call kairos_begin with kairos://mem/bbb22222-2222-2222-2222-222222222222 to execute this protocol"
    },
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002002",
      "label": "Get help refining your search",
      "chain_label": "Run protocol to turn vague user request into a better kairos_search query",
      "score": null,
      "role": "refine",
      "tags": ["meta", "refine"],
      "next_action": "call kairos_begin with kairos://mem/00000000-0000-0000-0000-000000002002 to get step-by-step help turning the user's request into a better search query"
    },
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002001",
      "label": "Create New KAIROS Protocol Chain",
      "chain_label": "Create New KAIROS Protocol Chain",
      "score": null,
      "role": "create",
      "tags": ["meta", "creation"],
      "next_action": "call kairos_begin with kairos://mem/00000000-0000-0000-0000-000000002001 to create a new protocol"
    }
  ]
}
```

### AI behavior

1. Pick one choice using `label`, `chain_label`, `tags`, and `score`.
2. If a match fits intent: follow that choice's `next_action`.
3. If results are off-topic: pick **refine** and use more words or details.
4. If the user wants a new protocol: pick **create**.

## Scenario 4: no matches

No choices above threshold. Only refine and create are available.

### Input

```json
{
  "query": "xyzqwerty nonexistent protocol foobar"
}
```

### Expected output

```json
{
  "must_obey": true,
  "message": "No existing protocol matched your query. Refine your search or create a new one.",
  "next_action": "Pick one choice and follow that choice's next_action.",
  "choices": [
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002002",
      "label": "Get help refining your search",
      "chain_label": "Run protocol to turn vague user request into a better kairos_search query",
      "score": null,
      "role": "refine",
      "tags": ["meta", "refine"],
      "next_action": "call kairos_begin with kairos://mem/00000000-0000-0000-0000-000000002002 to get step-by-step help turning the user's request into a better search query"
    },
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002001",
      "label": "Create New KAIROS Protocol Chain",
      "chain_label": "Create New KAIROS Protocol Chain",
      "score": null,
      "role": "create",
      "tags": ["meta", "creation"],
      "next_action": "call kairos_begin with kairos://mem/00000000-0000-0000-0000-000000002001 to create a new protocol"
    }
  ]
}
```

### AI behavior

1. No matches; only **refine** and **create** are available.
2. Pick **refine** to try a different query, or **create** to start the
   creation protocol.
3. Follow the chosen choice's `next_action`.

## Validation rules

1. `must_obey` is always `true`.
2. `choices` is always non-empty (at least one of: matches, refine,
   create).
3. Every choice has `uri`, `label`, `chain_label`, `score`, `role`,
   `tags`, and `next_action`.
4. Choices with `role: "match"` have a numeric `score` (0.0–1.0).
5. Choices with `role: "refine"` or `role: "create"` have `score: null`.
6. The **refine** choice, when present, has
   `uri: "kairos://mem/00000000-0000-0000-0000-000000002002"`.
7. The **create** choice, when present, has the creation protocol URI.
8. Global `next_action` is a short directive and does not embed a
   specific protocol URI (except in single-choice edge cases where it
   may duplicate the choice's `next_action`).
9. **Choice order:** All `role: "match"` entries come first; then at
   most one `role: "refine"`; then one `role: "create"`.

## See also

- [kairos_begin workflow](workflow-kairos-begin.md)
- [Full execution workflow](workflow-full-execution.md)
