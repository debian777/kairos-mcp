# Slug-Based Deterministic Protocol Routing

**Date:** 2026-03-21
**Status:** Feature Request
**Priority:** High — prerequisite for scaling protocol library

## Problem

Protocol-to-protocol routing currently uses `kairos_search` (vector/semantic search) for both user discovery and deterministic linking between protocols. As the protocol library grows, semantic search becomes unreliable for routing:

- "standardize execute ship" might match a different protocol about shipping
- "git commit policy" could match multiple similarly-named protocols
- Search results depend on embedding proximity, which shifts as new protocols are added
- Silent routing drift — the wrong protocol is loaded without any error

User discovery (fuzzy, ranked) and protocol routing (exact, deterministic) are fundamentally different operations that should not share the same mechanism.

## Proposal

### 1. Add `slug` field to protocol frontmatter

```yaml
---
slug: analyze-and-plan
---
# Standardize Project — Analyze and Plan
```

- Lowercase, hyphens, no special characters
- Author-controlled — can be shorter than H1 title
- Stored as an indexed Qdrant payload field (exact match, not vectorized)
- Enforced unique — `kairos_mint` rejects duplicate slugs

### 2. Add `key` parameter to `kairos_begin`

```
kairos_begin(key: "analyze-and-plan")
```

- `kairos_begin` continues to work primarily with `uri` (UUID) — this is the standard flow after `kairos_search` returns a match
- `key` is an **additional parameter** that allows starting a protocol without a prior search step — useful for deterministic protocol-to-protocol routing
- Exact match lookup on the `slug` payload field in Qdrant
- Returns the protocol or an error — no ranking, no ambiguity
- If both `uri` and `key` are provided, `uri` takes precedence

### 3. `kairos_mint` computes and stores the slug

| Frontmatter has `slug`? | Behavior |
|---|---|
| Yes | Index as-is, reject if duplicate exists on a different protocol |
| No | Auto-generate from H1: lowercase, strip special chars, spaces to hyphens |

On `kairos_update` (force mint): slug is preserved if title unchanged, recomputed if title changed. Old slug is released.

## Two Addressing Modes

| Operation | Tool | Input | Lookup |
|---|---|---|---|
| User finds a protocol | `kairos_search` | Natural language | Vector/semantic |
| Protocol links to protocol | `kairos_begin` | `key: "slug"` | Exact match |

## Protocol Authoring Impact

Routing challenges change from:

```json
{"challenge":{"type":"mcp","mcp":{"tool_name":"kairos_search","arguments":{"query":"standardize execute ship"}}}}
```

To:

```json
{"challenge":{"type":"mcp","mcp":{"tool_name":"kairos_begin","arguments":{"key":"execute-and-ship"}}}}
```

`kairos_search` remains for:
- Natural Language Triggers (user discovery)
- Runtime type-dispatch where target depends on a variable: `kairos_search("Standardize {project_type}")`
- Inline "see also" references in prose

## Qdrant Schema Change

Add to the protocol payload:

```json
{
  "slug": "analyze-and-plan"
}
```

Create a Qdrant payload index on `slug` field (keyword type, exact match).

## Implementation Scope

1. **`kairos_mint`** — compute slug from frontmatter or H1, store in payload, enforce uniqueness
2. **`kairos_begin`** — accept `key` parameter, do exact Qdrant filter lookup instead of vector search
3. **`kairos_update`** — preserve or recompute slug on update
4. **`kairos_dump`** / export — include slug in exported frontmatter

No changes to: `kairos_search`, `kairos_next`, `kairos_attest`.

## Design Principle

This separation reflects a broader principle:

- **Creation order:** generic protocols first, detailed extensions second
- **Linking order:** detailed protocols link back to generic via deterministic `key`
- **Discovery:** users find protocols via semantic search (fuzzy, forgiving)
- **Routing:** protocols find each other via slug (exact, reliable)
