# Charter: KAIROS MCP

This document defines why KAIROS MCP exists, what it optimizes for, and the
rules that keep it coherent as it grows. Read this before you change the
system’s behavior, APIs, or long-term direction.

## Origin

AI agents need durable memory and repeatable execution. Stateless chat
interfaces and ad hoc prompts lose context, make outcomes inconsistent, and
turn every session into a partial reboot.

KAIROS MCP exists to give AI agents persistent knowledge and a deterministic
execution loop that can be integrated into real tools.

## Mission

Make agent work durable and executable by providing:

- Persistent memory across sessions (store, retrieve, update, delete)
- Deterministic protocol execution (search → begin → next → attest)
- Agent-facing interfaces that teach correct usage and recover from errors

## Strategy

KAIROS MCP wins by being the most reliable “memory + protocol” substrate that
agent hosts can depend on.

We focus on:

- A small set of primitives that compose into many workflows
- Schemas and error messages that minimize agent confusion and retries
- Backends that orchestrate complexity so the agent-facing surface stays simple

## Success definition

KAIROS MCP succeeds when:

- New clients can implement the tool flow without guesswork.
- Protocol execution is repeatable, traceable, and hard to accidentally
  mis-sequence.
- The system can evolve without breaking agents or requiring hidden
  tribal knowledge.

## Non-goals

KAIROS MCP does not try to be:

- A general-purpose agent framework or planner
- A vector database or database abstraction layer
- A UI product for humans (humans operate it, but agents are the primary users)
- A place to store secrets, credentials, or regulated personal data

## Principles

These principles are project-wide. Apply them to architecture, APIs, code, and
documentation.

- **Agents are the primary users.** Optimize the interface for agent execution,
  not for human aesthetics.
- **Determinism over ambiguity.** Prefer one correct next action over many
  “possible” actions.
- **Teach in the interface.** Tool descriptions, schemas, and errors must
  explain what to do next.
- **Server generates; agent echoes.** Identifiers, nonces, and proof hashes are
  server-owned. The agent copies them back exactly.
- **Backend orchestrates complexity.** Validation, retries, state, idempotency,
  and integrations live behind the interface.
- **Make failure recoverable.** Errors must be actionable. Retry paths must be
  explicit.
- **Keep the core small.** Add primitives only when they unlock many workflows
  or eliminate systemic failure modes.

## Agent-facing design principles

This section is the detailed doctrine for the agent-facing surface: MCP tools,
schemas, descriptions, and error shapes. Apply it whenever you design or review
interfaces whose primary user is an AI agent.

### 1. MCP is a new application type: users are AI agents

- **Primary users are AI agents**, not humans. Design for programmatic
  consumption.
- Human operators exist, but the immediate consumer of your outputs is an
  LLM-driven agent.
- Every field name, description, and instruction is written for LLM
  comprehension.
- Avoid human-centric UX patterns (for example, vague “Try again” messages).
  Use structured, actionable instructions.

### 2. LLM-friendly language and descriptions (MCP frontend)

The MCP frontend — tool names, parameters, descriptions, and error messages —
must let the AI use MCP directly instead of reverse-engineering how tools and
parameters work.

- **Clear, consistent names** across tools and parameters. Same concept means
  the same name everywhere.
- **Unambiguous instructions.** Spell out exactly what to do.
- **Server generates; agent echoes.** Hashes, nonces, and identifiers are
  server-owned. The agent copies them back exactly.
- **Remove redundancy.** If `next_action` suffices, drop redundant state fields
  that increase cognitive load.
- **Describe field purpose in schema** so the agent knows when and how to use
  each field.
- **Errors teach, don’t punish.** Error messages and structured errors must
  guide the agent to correct and retry. Recovery is the default.

### 3. Frontend vs backend roles

- **Frontend (MCP tools, schemas, descriptions).** Optimize for agent
  comprehension and execution.
- **Backend.** Orchestrate complexity: business logic, validation, retries,
  idempotency, and state.

### 4. Outputs designed for execution

- **Embed URIs in `next_action`.** Prefer `next_action` that includes exact
  URIs and instructions the agent can copy.
- **Always provide an actionable next step** on success.
- **`must_obey` semantics** must be consistent and explicit:
  - `must_obey: true` means the agent must follow `next_action`.
  - `must_obey: false` means the agent may choose among options.
- **Unify response shapes** across tools to reduce patterns the agent must
  learn.

### 5. Error outputs that help execution

- **Errors are recoverable by default.**
- **Include fresh challenge data** on error so the agent can retry without
  re-fetching.
- **Include `next_action` in errors** that explains exactly how to retry using
  the data from that response.
- **Use structured error codes** for monitoring and for the agent to branch on.
- **Retry escalation**:
  - Retries 1–N: `must_obey: true` with a deterministic correction path.
  - After N retries: `must_obey: false` to allow repair, abort, or escalation.
- **Use a circuit breaker** to avoid infinite loops and retry storms.

### 6. Self-correcting workflows

- **Support repair paths.** After max retries, offer options such as updating
  the step or aborting the run.
- **Design for resilience.** Let protocols be improved mid-flight for future
  executions without breaking the current run.
- **Creation fallback.** When search finds no match, offer a deterministic
  “create new protocol” path.
- **Simplify ceremony.** Remove unnecessary gates; make the last step a normal
  verification step and keep attestation a simple stamp.

### 7. Checklist

Use this checklist when designing or reviewing agent-facing APIs:

- [ ] Outputs use LLM-friendly, consistent field names.
- [ ] `next_action` embeds exact URIs and instructions.
- [ ] Errors include recovery instructions and fresh data to retry.
- [ ] Two-phase error handling: retry first, then grant autonomy.
- [ ] No redundant fields; single source of truth for each concept.
- [ ] Server generates identifiers/hashes; agent echoes them.
- [ ] Self-correction paths (for example, `kairos_update`) are exposed and
      documented.
- [ ] Creation fallback exists when no match is found.

## Constraints

KAIROS MCP must:

- Remain safe to run in production with clear environment separation
  (dev/qa/live).
- Preserve backward compatibility or provide explicit upgrade paths for
  agent-facing changes.
- Maintain predictable operational dependencies (Redis + Qdrant) and avoid
  hidden state.

## Decision rules

When goals conflict:

1. Pick correctness and determinism over convenience.
2. Pick an interface that reduces agent errors over an interface that reduces
   developer typing.
3. Pick changes that simplify the agent-facing surface over changes that move
   complexity into agents.

## Related documentation

- **Architecture and protocol workflows** (`docs/architecture/README.md`):
  operational reference for the search → begin → next → attest loop.
