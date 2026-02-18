# Post-implementation doc review

Step 0 (pre-implementation human gate) was skipped. A **post-implementation review** of docs was done so they match the current implementation.

## Checklist (reviewed/updated)

- [x] **workflow-full-execution.md** — Title and flow: "search to run complete"; last step returns "Run complete."; Step 4 (attest) removed; flow summary updated.
- [x] **workflow-kairos-attest.md** — Deprecation notice at top: run complete after last kairos_next; tool kept for optional override.
- [x] **workflow-kairos-next.md** — Last step: no attest step; next_action "Run complete.".
- [x] **workflow-kairos-begin.md** — Single-step: next_action "Run complete." (no attest).
- [x] **workflow-kairos-mint.md** — Flow wording: search → begin → next → run complete. SIMILAR_MEMORY_FOUND already documents kairos_dump in next_action.
- [x] **workflow-kairos-search.md** — Already documents choices + scores; perfect_matches removed.
- [x] **workflow-kairos-dump.md** — Exists; dump contract (markdown_doc, JSON challenge block).
- [x] **quality-metadata.md** — Quality in kairos_next is main path; attest deprecated (optional override only).
- [x] **architecture/README.md** — Protocol order: search → begin → next → run complete; attest deprecated; full execution link text updated.
- [x] **docs/README.md** — Architecture link text: search → begin → next → run complete.
- [x] **AGENTS.md, embed-docs, contextual-prompt** — Updated earlier: run complete, no attest in loop; kairos_attest.md deprecated.

## Summary

All workflow and architecture docs now state that the protocol ends when `next_action` says "Run complete." after the last `kairos_next`. Quality is updated in kairos_next; `kairos_attest` is deprecated (optional override or backward compatibility only).
