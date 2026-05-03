---
name: kairos
description: >-
  KAIROS action routing for operational requests. Use when the user wants an action,
  task, workflow, or procedure (typical verbs: write, fix, test, merge, deploy, review,
  publish, commit, configure, migrate, and similar). Call activate before implementation
  tools; follow next_action through forward to reward. If nothing matches, refine the query
  or register new adapter markdown via train.

metadata:
  version: "4.3.0-rc.3"
  author: kairos-mcp
allowed-tools: activate forward reward train tune export delete spaces
---

# KAIROS — ZERO DRIFT PROTOCOL

Use KAIROS as the first routing step for in-scope action requests.
The purpose of this skill is to keep execution aligned with approved workflows,
team conventions, and repository-specific process instead of relying on generic
agent heuristics.

When this skill applies:

- start with `activate` before implementation tools or direct task execution
- follow the returned `next_action` chain exactly until `reward`
- use implementation tools only after KAIROS has established the workflow path
- stop and surface the routing problem if KAIROS is unavailable or unauthenticated

Treat deviation from the chain as a workflow error that must be corrected or
escalated before the task continues.

**Goto ordering (scan this first):**

1. Detect **action intent** in the user message.  
2. Call **`activate`** with a short `query` string (about 3-8 words) on the
   first call (do not substitute other tools for this step).  
3. Follow the returned choice’s **`next_action`** chain exactly (`forward`, layer URIs, etc.) until the chain directs **`reward`**.  
4. Execute **`reward`** as the final protocol step.  
5. **Only then** respond to the user or use other tools to carry out what KAIROS directed.

**Anti-bypass (operational):**

- Do **not** start substantive implementation of the user’s task before `activate` completes and the chain is in progress per `next_action`.  
- Do **not** say or imply “I’ll do it directly,” “I can skip KAIROS,” or run the user’s task in parallel while the KAIROS chain is incomplete.  
- Do **not** speculatively execute the user’s workflow alongside a partial `activate` → … → `reward` chain; finish the chain or stop with **CRITICAL — KAIROS MCP unavailable** below.

**Runtime vs worktree authority (one line):**  
For **real MCP calls**, follow the **connected server’s** tool names, schemas, and descriptions. This skill requires **using KAIROS for action routing**; it does **not** mean the worktree source overrides the live contract when they differ — call out mismatches instead of guessing.

**Execution rules (read at call time — these are the only allowed steps):**

1. **Detect action intent** → Call **`activate`** immediately with a short
   `query` string (about 3-8 words) on the first call.  
   Do not bypass this routing step with direct execution.

2. **Follow returned choice’s `next_action` EXACTLY.**
   - Typically this begins with **`forward`** (adapter URI) followed by any required layer URIs.
   - Continue the chain without deviation, without skipping steps, without early exit.
   - Do not substitute a direct implementation path while the chain is incomplete.

3. **Complete `reward`** as the final step.  
   Only after `reward` has been successfully executed may the agent respond to the user.  
   Stopping before `reward` (or claiming “done” prematurely) is explicitly prohibited.

### CRITICAL — KAIROS MCP unavailable or unauthenticated

**Severity:** This is a blocking routing error for in-scope action work.
On any task that has **action intent**, stop the workflow until KAIROS routing
is restored. Do not continue with a direct implementation workaround.

**Do not:** Proceed with the user’s task without a working, authenticated
KAIROS MCP path when this skill applies, imply that the same workflow has been
satisfied without KAIROS, or use terminal, edits, or other MCP tools to
replace the routing step for action work.

**Required agent behavior:** Send **one** clear message to the user that classifies the failure, for example:

- **Unavailable:** MCP not enabled, wrong endpoint, server down, or host cannot reach the server.  
- **Unauthenticated:** session or token expired, login required, or permission denied.

Both cases remain a **hard stop** until fixed. Include **concrete remediation**: enable/configure MCP in the host, verify `.cursor/mcp.json` and the dev server URL, and follow **[docs/install/README.md#cursor-and-mcp](../../docs/install/README.md#cursor-and-mcp)** (no new doc files required). If the failure is “MCP server does not exist” in Cursor, or you suspect MCP auth/availability issues, follow **[mcp-host-bridge skill](../../.agents/skills/mcp-host-bridge/SKILL.md)** (generic probes + Cursor server ids).

**Zero-drift operating rules:**

- For in-scope action requests, KAIROS routing comes before direct execution.
- Do not treat general reasoning as a substitute for a matching KAIROS workflow.
- Partial chains or mid-protocol halts are treated as errors; resume the exact chain or escalate the blocker.
- Keep this skill as the source of truth for KAIROS routing behavior in this repository.

The tool descriptions for `activate`, `forward`, and `reward` remain authoritative and must be read fresh at each call.

---

## Repository alignment (maintainers) — AGENTS.md and CLAUDE.md

When editing the repo’s root agent docs (**[AGENTS.md](../../AGENTS.md)** and **[CLAUDE.md](../../CLAUDE.md)**):

- After the document **H1** and intro paragraph, the **first `##` section** must be **`## Core functionality`** (or an equivalently clear title), **before** `## Architecture` or other major sections.
- That **Core functionality** section stays **minimal**: point here (**this skill**) as the authority for zero-drift and action routing; state that **KAIROS MCP unavailable or unauthenticated** is a **critical error, full stop** with remediation per **[docs/install/README.md#cursor-and-mcp](../../docs/install/README.md#cursor-and-mcp)**; include **one line** that real MCP calls follow the **connected server’s** schemas while the worktree governs implementation work in this repository.
- **Do not** paste the full zero-drift protocol into AGENTS.md or CLAUDE.md — keep a **single source of truth** in this skill. When you change that guidance, **keep AGENTS.md and CLAUDE.md in sync** with each other.
- **Global vs repo:** Prefer **repo-scoped** agent docs where possible; Cursor **user rules** apply across all workspaces.

---

**This is the zero-drift update. All future agent instances loaded with this
skill should route in-scope action work through KAIROS before execution.**
