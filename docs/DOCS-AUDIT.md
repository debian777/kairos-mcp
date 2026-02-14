# Documentation audit report

This report audits the repository documentation against the docs-writer skill
standards (voice and tone, language and grammar, formatting and syntax,
structure). It covers `docs/`, `README.md`, `CONTRIBUTING.md`, and `SECURITY.md`.
`AGENTS.md` is agent-instruction content and is only lightly reviewed.

---

## Summary

| File                | Overall    | Priority issues                  | Minor issues                                 |
| ------------------- | ---------- | -------------------------------- | -------------------------------------------- |
| docs/INSTALL-MCP.md | Needs work | Missing BLUF, no procedures      | Minimal content                              |
| docs/CLI.md         | Good       | None                             | Tone, 80-char wrap, placeholders, Next steps |
| CONTRIBUTING.md     | Good       | "Please", missing overview paras | Minor wording                                |
| README.md           | Good       | "Please", warning format         | Line length, one "please"                    |
| SECURITY.md         | Good       | "Please" (x2), missing overview  | —                                            |

---

## docs/INSTALL-MCP.md

**Gaps**

- No BLUF or introductory paragraph. A reader does not know what this page is
  for or what they will do (install the KAIROS MCP server in Cursor).
- No procedure. The page is only a badge and a JSON snippet. There are no
  numbered steps (for example: start the KAIROS server, add the config, use the
  deep link or paste the config into Cursor).

**Suggestions**

1. Add an introductory paragraph: state that the page describes how to install
   the KAIROS MCP server in Cursor and what the reader will need (running
   server, Cursor).
2. Add a short procedure: e.g. (1) Start the KAIROS server locally, (2) Add the
   MCP config to Cursor (paste the JSON or use the deep link), (3) Reload
   Cursor or restart MCP.
3. Optionally add a **Note** that the server must be running at the configured
   URL and that `alwaysAllow` lists the KAIROS tools that Cursor may run
   without prompting.

---

## docs/CLI.md

**Strengths**

- Clear title and intro. Installation has multiple options with imperative
  steps. Commands are grouped with overview text. Examples are concrete.

**Voice and tone**

- Line 23: "This creates a global symlink, so the `kairos` command is
  available system-wide." Consider addressing the reader: "After linking, the
  `kairos` command is available system-wide" (or similar) to keep "you"
  perspective.
- Line 64: "**Note:**" is used correctly; keep this pattern for other notes.

**Formatting and structure**

- **Line length:** Several code blocks or option descriptions exceed 80
  characters. Wrap prose at 80 characters where possible; long command
  examples can stay on one line if needed.
- **Overview paragraphs:** Most sections have an intro; "Examples" (line 163)
  has no sentence before the code block. Add one line (e.g. "The following
  commands show common workflows.").
- **Next steps:** Add a short "Next steps" at the end (e.g. link to server
  setup in README and to INSTALL-MCP for Cursor integration).

**Language and examples**

- Placeholders like `kairos://mem/xxx` and `kairos://mem/yyy` are used
  throughout. The standard prefers meaningful examples. Options: (1) use one
  concrete example ID in the first occurrence and say "memory URI" elsewhere, or
  (2) add a short note that `xxx` and `yyy` stand for memory URIs from
  `kairos begin` or `kairos next`.

**Optional**

- Option names in "Options:" lists could be formatted with **bold** for
  consistency with the skill (e.g. **`--follow`**, **`--output`**).

---

## CONTRIBUTING.md

**Voice and tone**

- Line 3: "Thank you for your interest in contributing to KAIROS MCP!" is
  fine. Consider tightening to "This document explains how to contribute" (or
  similar) for a more direct BLUF.
- Line 87: "Feel free to open an issue" — acceptable; could be "Open an issue
  for questions or discussions" to avoid "feel free."
- Line 89: "Thank you for contributing to KAIROS MCP!" — keep as is.

**Requirements vs. recommendations**

- Line 37: "**Important:** Always deploy before testing." — Good. No "should"
  in critical steps.

**"Please"**

- Line 76: "When reporting issues, please include:" → "When reporting issues,
  include:" (or "Reports must include:").
- Line 84: "Feature requests are welcome! Please open an issue" → "Open an
  issue with:" (drop "Please").

**Structure**

- **Reporting Issues** (line 74): The heading is followed immediately by a
  list. Add one overview sentence (e.g. "Include the following so we can
  reproduce and fix the issue.").
- **Feature Requests** (line 82): Same. Add one sentence before the list (e.g.
  "Open an issue and describe the feature, use case, and optional
  implementation ideas.").

**Getting Started**

- Step 2: "YOUR_USERNAME" is a common placeholder; consider adding "(replace
  with your GitHub username)" in parentheses so it is explicit.

---

## README.md

**Strengths**

- Clear project description, BLUF-style intro for Build/Deploy/Test, and
  imperative steps. Good use of **bold** for script names and important
  warnings. Link to CLI docs is descriptive.

**Voice and tone**

- Line 54: "Why deploy first?" — Good. Active and clear.

**Warnings**

- Lines 14 and 41: "⚠️ IMPORTANT" and "⚠️ REQUIRED" are used. The standard
  suggests `> **Warning:**` for warnings. Consider: `> **Warning:** Always
deploy before testing. Tests run against…` for consistency.

**"Please"**

- Line 179: "Please read our [Contributing Guide]" → "Read the [Contributing
  Guide](CONTRIBUTING.md) for…" (drop "Please").

**Structure**

- Snapshot Management (line 110): One sentence then bullets. Add a single
  overview sentence before the list if you want every heading to have a full
  paragraph (e.g. "You can back up the Qdrant vector database in two ways.").

**Line length**

- Some lines (e.g. in script lists or notes) exceed 80 characters. Wrap
  prose at 80 where it does not hurt readability.

---

## SECURITY.md

**Structure**

- **Security Best Practices** (line 21): The heading is followed by a list.
  Add one overview sentence (e.g. "Follow these practices when running KAIROS
  MCP.").

**"Please"**

- Line 12: "please **do not** open a public issue" → "Do not open a public
  issue. Report the vulnerability privately instead."
- Line 14: "please report it privately" — removed by the above rewrite.
- Line 14: "please report it privately: 1. Email…" → "Report it privately: 1.
  Email…"

**Other**

- Table and numbered steps are clear. "We will respond within 48 hours" is
  good and sets expectations.

---

## AGENTS.md

This file is agent/IDE instruction content rather than user-facing docs.
Reviewed only for consistency:

- No changes required for end-user doc standards. Tone is imperative and
  consistent with its purpose. The "USE CONTEXT7" and "ENVIRONMENT CONTEXT"
  sections are operational, not docs to publish.

---

## Cross-cutting recommendations

1. **Project naming:** Use "KAIROS MCP" for the server and "KAIROS CLI" for the
   CLI consistently (already mostly consistent).
2. **Notes and warnings:** Use `> **Note:**` and `> **Warning:**` in docs/ and
   README so formatting is consistent.
3. **Sidebar/navigation:** There is no `docs/sidebar.json` in this repo. If you
   add more doc pages, consider a simple nav or index in `docs/` (e.g.
   README.md in docs pointing to INSTALL-MCP and CLI).
4. **Format:** After applying edits, run `npm run format` if the project
   supports it, to keep formatting consistent.

---

## Suggested order of changes

1. **High impact:** docs/INSTALL-MCP.md — add BLUF and a short procedure so
   the page is self-contained and actionable.
2. **Quick wins:** Remove "please" and add missing overview sentences in
   CONTRIBUTING.md, README.md, SECURITY.md; add one intro sentence before the
   Examples block in docs/CLI.md and a "Next steps" section.
3. **Polish:** 80-character wrap and optional **bold** for CLI options in
   docs/CLI.md; standardize warning blocks in README; clarify placeholders in
   CLI examples.
