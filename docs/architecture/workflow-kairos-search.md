# kairos_search workflow

Unified response schema for all `kairos_search` scenarios. Every response
returns `must_obey: true` with a consistent shape.

## Unified response schema

```json
{
  "must_obey": true,
  "message": "<string>",
  "next_action": "<string>",
  "choices": [
    {
      "uri": "kairos://mem/<uuid>",
      "label": "<string>",
      "chain_label": "<string or null>",
      "score": "<number 0.0-1.0, or null for non-match entries>",
      "role": "<match|create>",
      "tags": ["<string>"]
    }
  ]
}
```

Fields present in every response:

- `must_obey` — always `true`
- `message` — human-readable summary (e.g. "Found N matches" or "No existing protocol matched")
- `next_action` — deterministic instruction for the AI agent
- `choices` — array of options; each has a `role` field:
  - `"match"` — a search result with a numeric `score` (0.0-1.0)
  - `"create"` — system action to create a new protocol (`score: null`,
    not a search result)

Fields that no longer exist:

- `start_here` — use `choices[0].uri` instead
- `best_match` — use `choices` with scores instead
- `suggestion` / `hint` — merged into `message`
- `perfect_matches` / `multiple_perfect_matches` — removed; use `choices` and scores
- `protocol_status` — removed; `must_obey: true` + `next_action` is sufficient

---

## Scenario 1: single match

One protocol matches. The AI must call `kairos_begin` with the URI
embedded in `next_action`.

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
  "next_action": "call kairos_begin with kairos://mem/bd939b2a-b35f-40f2-8dec-7dec74a65116 to execute protocol",
  "choices": [
    {
      "uri": "kairos://mem/bd939b2a-b35f-40f2-8dec-7dec74a65116",
      "label": "EXTENSION — NATURAL LANGUAGE → CODING → KAIROS (MANDATORY)",
      "chain_label": "EXTENSION — NATURAL LANGUAGE → CODING → KAIROS (MANDATORY)",
      "score": 1.0,
      "role": "match",
      "tags": ["coding", "deploy", "mandatory"]
    }
  ]
}
```

### AI behavior

1. Read `next_action` — it contains the exact URI.
2. Call `kairos_begin` with `{"uri": "kairos://mem/bd939b2a-b35f-40f2-8dec-7dec74a65116"}`.

---

## Scenario 2: multiple matches

Several protocols match. The AI picks one from `choices` and calls
`kairos_begin` with that choice's URI.

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
  "message": "Found 3 matches (top confidence: 85%). Choose one or create a new protocol.",
  "next_action": "call kairos_begin with <top_uri> to execute best match, or choose another from choices",
  "choices": [
    {
      "uri": "kairos://mem/2ab737f0-a9b1-49a0-bb10-5c8105c4f6e8",
      "label": "Core Principles / Discovery & Pattern Analysis",
      "chain_label": "Create Jira Ticket in BIB - Bug",
      "score": 1.0,
      "role": "match",
      "tags": ["jira", "issue", "creator", "bib", "bug"]
    },
    {
      "uri": "kairos://mem/5b1d29a7-edc5-4ad1-9938-f50f20143f79",
      "label": "Core Principles / Discovery & Pattern Analysis",
      "chain_label": "Create Jira Ticket in BIB - Story",
      "score": 1.0,
      "role": "match",
      "tags": ["jira", "issue", "creator", "bib", "story"]
    },
    {
      "uri": "kairos://mem/80ed2aa7-93da-46f6-88c3-90a8a93a6712",
      "label": "Core Principles / Discovery & Pattern Analysis",
      "chain_label": "Create Jira Ticket in BIB - Task",
      "score": 1.0,
      "role": "match",
      "tags": ["jira", "issue", "creator", "bib", "task"]
    }
  ]
}
```

### AI behavior

1. Read `choices` — multiple options, all `role: "match"` with score 1.0.
2. Pick the best match based on user intent and `chain_label`.
3. Call `kairos_begin` with the chosen URI.

---

## Scenario 3: weak matches (score < 1.0)

No protocol scores 1.0 but some are above the threshold. The "Create New
Protocol Chain" is appended with `role: "create"` and `score: null` to
distinguish it from search results.

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
  "message": "Found 2 matches (top confidence: 85%). Choose one or create a new protocol.",
  "next_action": "call kairos_begin with <top_uri> to execute best match, or choose another from choices",
  "choices": [
    {
      "uri": "kairos://mem/aaa11111-1111-1111-1111-111111111111",
      "label": "Database Operations / Migration Steps",
      "chain_label": "Database Migration Workflow",
      "score": 0.85,
      "role": "match",
      "tags": ["database", "migration", "ops"]
    },
    {
      "uri": "kairos://mem/bbb22222-2222-2222-2222-222222222222",
      "label": "Rollback Procedures",
      "chain_label": "Emergency Rollback Protocol",
      "score": 0.72,
      "role": "match",
      "tags": ["rollback", "emergency", "ops"]
    },
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002001",
      "label": "Create New KAIROS Protocol Chain",
      "chain_label": "Create New KAIROS Protocol Chain",
      "score": null,
      "role": "create",
      "tags": ["meta", "creation"]
    }
  ]
}
```

### AI behavior

1. Read `choices` — scored matches (`role: "match"`) plus the creation
   option (`role: "create"`).
2. If a match fits the user's intent, pick it.
3. If none fits, pick the `role: "create"` option to guide the user through
   creating a new chain.
4. Call `kairos_begin` with the chosen URI.

---

## Scenario 4: no matches

No protocol meets the threshold. The only choice is the creation protocol.

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
  "message": "No existing protocol matched your query. You can create a new one.",
  "next_action": "call kairos_begin with kairos://mem/00000000-0000-0000-0000-000000002001 to create a new protocol",
  "choices": [
    {
      "uri": "kairos://mem/00000000-0000-0000-0000-000000002001",
      "label": "Create New KAIROS Protocol Chain",
      "chain_label": "Create New KAIROS Protocol Chain",
      "score": null,
      "role": "create",
      "tags": ["meta", "creation"]
    }
  ]
}
```

### AI behavior

1. Read `next_action` — it contains the creation protocol URI.
2. Call `kairos_begin` with
   `{"uri": "kairos://mem/00000000-0000-0000-0000-000000002001"}`.
3. The creation protocol starts with a `user_input` challenge asking the
   user if they want to create a new chain, so the AI never auto-creates.

---

## Validation rules

These rules apply to every `kairos_search` response:

1. `must_obey` is always `true`.
2. `choices` is always a non-empty array (at minimum, the creation protocol).
3. Every choice has `uri`, `label`, `chain_label`, `score`, `role`, `tags`.
4. Choices with `role: "match"` have a numeric `score` (0.0-1.0).
5. Choices with `role: "create"` have `score: null`.
6. `next_action` is always a non-empty string.
7. The following fields must NOT be present: `start_here`, `best_match`,
   `suggestion`, `hint`, `protocol_status`.
