> **Note:** This document describes a goal-state design decision. As of
> March 2026, session handover is not yet implemented.

# Session handover (goal state)

The **session handover file** is a small, durable artifact that lets a
protocol run resume after the client restarts or the user switches to
another client (for example, Cursor restart or a different IDE). The
KAIROS server writes it when a run is in progress. It is optional.

## Purpose

- **Resumability:** When the client or machine stops mid-run, the next
  session reads the handover file and continues from the last known state
  (for example, current challenge, partial results).
- **Cross-client:** Store the file in a known location (for example,
  workspace root) so another client or agent run can pick up the same
  session.

## File name and location

- **Name (example):** `kairos-session-handover.txt`
- **Location:** Defined by the implementation (for example, workspace
  root, or a path the client provides). This document only defines the
  **format** of the contents.

## Format (goal state)

Plain text, key-value style. Example:

```
SESSION_ID: kairos-mcp-challenge-abc123
current_challenge: resolve_participants
chain_uri: kairos://mem/step1-uuid-...
step_index: 1
participants: {"Adam": "adam.smith@company.com", "Candy": null}
updated_at: 2025-11-25T14:30:00Z
```

### Fields

| Field | Description |
|-------|-------------|
| `SESSION_ID` | Unique ID for this protocol run (generated at begin). Used to match the handover to the same run after restart. |
| `current_challenge` | Identifier of the current step/challenge (for example, resolve_participants, find_slot, create_event). |
| `chain_uri` | URI of the current step. Enables "resume from this step." |
| `step_index` | Optional; 1-based index in the chain. |
| Partial state | One or more key-value lines with step-specific state (for example, participants, proposed_slot). Names and values are protocol-defined. |
| `updated_at` | Timestamp of last update so clients can detect staleness. |

Additional key-value pairs can be added for domain-specific state (for
example, `proposed_slot`, `duration_minutes`). The server writes this
file when it advances or pauses; the implementation plan will define
when exactly it is written and where it is stored.

## How resumability works

1. **During run:** The server updates the handover file after each step
   or when issuing a sampling request, with `SESSION_ID`,
   `current_challenge`, `chain_uri`, and any partial state.
2. **After restart:** The client or agent reads the handover file, gets
   `SESSION_ID` and `chain_uri`, and calls `kairos_begin` (or a "resume"
   entry point) with `SESSION_ID` or `chain_uri` to continue. When the
   server supports resume, it uses partial state to avoid re-asking for
   already-known data.
3. **Cleanup:** When the run completes (`kairos_attest`) or is abandoned,
   the server or client removes or clears the handover file so the next
   run starts clean.

## Out of scope

- Exact API for "resume" (for example, a dedicated tool or parameter to
  `kairos_begin`).
- Where the file is stored and how the client tells the server the path
  (belongs to the implementation plan).
- Concurrency (what happens when two clients read the same handover file);
  single-run, single-client resumability is the main goal.

## See also

- [01-target-architecture.md](01-target-architecture.md)
- [03-workflow-protocol-run.md](03-workflow-protocol-run.md)
