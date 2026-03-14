# kairos_search workflow

`kairos_search` returns a unified `choices` array for all scenarios. Every
response has `must_obey: true`. The **server places the best action at
index 0**; the agent MUST follow the top choice only (no evaluation of
other choices). Each choice has its own `next_action`.

## Unified response schema

```json
{
  "must_obey": true,
  "message": "<string>",
  "next_action": "You MUST pick the top choice (index 0) and follow that choice's next_action.",
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
- `message` — summary (e.g. "Found 1 match.", "No strong match found. Follow the top choice to refine your search.")
- `next_action` — global directive: "You MUST pick the top choice (index 0) and follow that choice's next_action."
- `choices` — array of options; **the best action is always at index 0**. Each choice has:
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

**Ordering:** The server performs semantic dispatch and places the best
action at **index 0**. For a strong single match, that match is at 0. For
no match or weak top score, refine is at 0. For explicit creation intent
(e.g. "create new protocol"), create is at 0. The agent must follow
`choices[0]` only.

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
  "next_action": "You MUST pick the top choice (index 0) and follow that choice's next_action.",
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

1. Follow the top choice (index 0); call `kairos_begin` with its URI.
2. Do not evaluate other choices; the server has placed the best action at 0.

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
  "message": "Found 3 matches (top confidence: 52%).",
  "next_action": "You MUST pick the top choice (index 0) and follow that choice's next_action.",
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

1. Follow the top choice (index 0) only; call `kairos_begin` with its URI.
2. The server has placed the best match at index 0; do not evaluate other choices.

## Scenario 3: weak matches

No strong match (score &lt; 0.5); top scores are modest (e.g. 0.38–0.47). The server
places **refine** at index 0 so the agent runs the refine protocol first.

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
  "message": "No strong match found. Follow the top choice to refine your search.",
  "next_action": "You MUST pick the top choice (index 0) and follow that choice's next_action.",
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

1. Follow the top choice (index 0) — **refine**. Call `kairos_begin` with the refine protocol URI.
2. Do not evaluate other choices; the server has placed refine at 0 for weak matches.

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
  "message": "No strong match found. Follow the top choice to refine your search.",
  "next_action": "You MUST pick the top choice (index 0) and follow that choice's next_action.",
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

1. Follow the top choice (index 0) — **refine**. Call `kairos_begin` with the refine protocol URI.
2. Do not evaluate other choices; the server has placed refine at 0 when there are no matches.

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
8. Global `next_action` is always: "You MUST pick the top choice (index 0) and follow that choice's next_action."
9. **Choice order:** The server determines the best action and places it at **index 0**. The agent must follow `choices[0]` only. Remaining order (matches, refine, create) depends on dispatch: strong match at 0, or refine at 0 for weak/no match, or create at 0 for creation intent.

## See also

- [kairos_begin workflow](workflow-kairos-begin.md)
- [Full execution workflow](workflow-full-execution.md)
