---
name: kairos-bug-report
description: >-
  Produce a structured Markdown bug report for the latest MCP
  interaction, especially KAIROS MCP failures. Use when the user asks
  for an MCP bug report or to document a failed MCP tool or resource
  call. Save the report under reports/ with secrets redacted.
---

# kairos-bug-report

Use this skill to capture a single MCP failure as a report under
`reports/`. Use the latest relevant interaction unless the user points
to a specific call.

**MISSION:** Produce a single Markdown bug report for the latest MCP
interaction (or a user-specified one). Keep an exact 1-to-1 mapping
between the structure below and the report: every section in this order,
with no extra top-level sections.

**STRUCTURE (exact order, never skip):**
1. Summary
2. Calls and responses
3. Reasoning
4. Environment / context
5. Reproduction
6. Checklist before saving

**CONTENT TYPES:**
- **Summary:** One sentence: failure + MCP server name + tool/resource.
- **Calls and responses:** For each call: request in fenced `json`
  (server, tool/resource, arguments); response in fenced `json` (full
  payload or error). Preserve order.
- **Reasoning:** Why each call was made, how responses were interpreted,
  and where the bug likely is (client, server, schema, docs, or
  unclear).
- **Environment / context:** IDE/MCP version, OS, and relevant
  config/env names only. Never include secret values.
- **Reproduction:** Minimal steps; expected vs. actual in one or two
  sentences.
- **Checklist before saving:** Markdown task list (`- [ ]`) with the
  five items below.

**MUST:**
- Emit all six sections in order.
- Use fenced code blocks with language `json` for every request and
  response.
- Redact secrets, tokens, cookies, and API keys in any JSON.
- Save under `reports/` as
  `mcp-bug-<server>-<short-description>-<date>.md`.
- Complete the checklist in the report before saving.

**MUST NOT:**
- Add top-level sections not in STRUCTURE (for example Appendix, Notes,
  or Extra).
- Omit or reorder sections.
- Put request/response in plain text or non-JSON code blocks.
- Include unredacted secrets, tokens, cookies, or API keys.

---

## Checklist before saving

- [ ] Summary states server, tool/resource, and the failure in one
  sentence.
- [ ] All relevant MCP calls and responses are in JSON code blocks with
  secrets redacted.
- [ ] Reasoning explains the intent of each call and the interpretation
  of each response.
- [ ] Reproduction steps are minimal and someone else could follow them.
- [ ] File is saved in `reports/` with filename
  `mcp-bug-<server>-<short-description>-<date>.md`.
