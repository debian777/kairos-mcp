# Session handover (goal state)

This document describes the **session handover file** in the target architecture: a small, durable artifact that allows a protocol run to be **resumed** after the client restarts or the user switches to another client (e.g. Cursor restart, different IDE). It is optional and written by the KAIROS server when a run is in progress.

---

## Purpose

- **Resumability:** If the client or machine stops mid-run, the next session can read the handover file and continue from the last known state (e.g. current challenge, partial results).
- **Cross-client:** The file can be stored in a known location (e.g. workspace or user config) so another client or agent run can pick up the same session.

---

## File name and location

- **Name (example):** `kairos-session-handover.txt`
- **Location:** Defined by implementation (e.g. workspace root, or a path the client provides). This doc only defines the **format** of the contents.

---

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

### Fields (conceptual)

| Field | Description |
|-------|-------------|
| **SESSION_ID** | Unique id for this protocol run (e.g. generated at begin). Used to match handover to the same run after restart. |
| **current_challenge** | Identifier of the current step/challenge (e.g. resolve_participants, find_slot, create_event). |
| **chain_uri** | URI of the current step (e.g. kairos://mem/step1-uuid-...). Enables “resume from this step.” |
| **step_index** | Optional; 1-based index in the chain. |
| **Partial state** | One or more key-value lines with step-specific state (e.g. participants, proposed_slot). Names and values are protocol-defined. |
| **updated_at** | Timestamp of last update so clients can detect staleness. |

Additional key-value pairs can be added for domain-specific state (e.g. proposed_slot, duration_minutes). The server writes this file when it advances or when it pauses (e.g. waiting for sampling result); the implementation plan will define when exactly it is written and where it is stored.

---

## How resumability works

1. **During run:** Server updates the handover file (e.g. after each step or when issuing a sampling request) with SESSION_ID, current_challenge, chain_uri, and any partial state.
2. **After restart:** Client or agent reads the handover file, gets SESSION_ID and chain_uri (and optionally current_challenge / step_index). It can then call kairos_begin or a “resume” entry point with SESSION_ID or chain_uri to continue. The server, when it supports resume, uses the partial state to avoid re-asking for already-known data.
3. **Cleanup:** When the run completes (kairos_attest) or is abandoned, the server (or client) can remove or clear the handover file so the next run starts clean.

---

## Out of scope

- Exact API for “resume” (e.g. a dedicated tool or parameter to kairos_begin).
- Where the file is stored and how the client tells the server the path (implementation plan).
- Concurrency (what happens if two clients read the same handover file); single-run, single-client resumability is the main goal.
