# Bundled meta-protocols

This directory contains the bundled KAIROS-internal adapters and policy
documents that are injected into the Kairos app space at boot.

Version: **4.0.1**

## Philosophy

KAIROS exists for AI agents and for human–AI harmony.

The bundle is designed to help agents recognise the right mode at the right
time: discovery, clarification, ideation, planning, execution, validation,
review, and handoff. The bundle prefers truth, explicit sequencing, and
observable verification over polished but weak wording.

## Protocols

| UUID | Slug | Purpose |
|------|------|---------|
| [2001](00000000-0000-0000-0000-000000002001.md) | `create-new-protocol` | Authoring adapter — create, review, or refactor KAIROS protocols |
| [2003](00000000-0000-0000-0000-000000002003.md) | `create-new-protocol-review` | Review adapter — format review, stranger review, approval, train |
| [2002](00000000-0000-0000-0000-000000002002.md) | `refine-search` | Refine search — recover user intent after failed `activate` |
| [2005](00000000-0000-0000-0000-000000002005.md) | `phase-critic` | Phase-boundary adversarial review — verify claims against evidence |

### Linked authoring flow

```text
2001 (Author) → activate("Review and Publish New KAIROS Protocol") → 2003 (Review & Publish)
```

## Reference Documents

| UUID | Slug | Purpose |
|------|------|---------|
| [2004](00000000-0000-0000-0000-000000002004.md) | `challenge-type-guide` | Challenge type selection, interpreter choice, and stronger verification patterns |
