# Bundled meta-protocols

This directory contains the bundled KAIROS-internal protocol chains and policy
documents that are injected into the Kairos app space at boot.

## Protocols

| UUID | Slug | Purpose |
|------|------|---------|
| [2001](00000000-0000-0000-0000-000000002001.md) | `create-new-protocol` | Chain 1: Author — gather requirements, draft protocol markdown |
| [2003](00000000-0000-0000-0000-000000002003.md) | `create-new-protocol-review` | Chain 2: Review & Publish — format review, stranger review, approval, mint |
| [2002](00000000-0000-0000-0000-000000002002.md) | `refine-search` | Refine search — improve a failed kairos_search query |
| [2005](00000000-0000-0000-0000-000000002005.md) | `phase-critic` | Phase boundary adversarial review — verify plan/implementation against artifacts and invariants |

### Chained authoring flow

```
2001 (Author) → kairos_begin(key: "create-new-protocol-review") → 2003 (Review & Publish)
```

## Reference Documents

| UUID | Slug | Purpose |
|------|------|---------|
| [2004](00000000-0000-0000-0000-000000002004.md) | `challenge-type-guide` | Decision tree, JSON formats, interpreter selection, anti-patterns for challenge types. Loaded as policy target by 2001 and 2003. |
