# Anti-Patterns Gallery

> "Every way documentation fails has been done before."

## Git Documentation Failure Modes

### 1. README is the Only Doc

**Symptom:** Everything crammed into one massive README.

**What it looks like:**
- 3000-line README
- User guide + dev guide + API reference + architecture
- Impossible to navigate

**Fix:** Create `docs/` directory. Split by audience.

*See: [Architecture](01-architecture.md)*

---

### 2. No Developer Setup Docs

**Symptom:** "Just clone and run" — but it doesn't work.

**What it looks like:**
- No `CONTRIBUTING.md`
- Missing prerequisites
- Outdated setup instructions
- New contributors ask the same questions

**Fix:** Write `docs/dev/setup.md`. Test on fresh machine.

*See: [Human Developers](03-human-devs.md)*

---

### 3. Vague AI Context

**Symptom:** AI agents hallucinate because instructions are ambiguous.

**What it looks like:**
- No `CLAUDE.md`
- Instructions like "configure appropriately"
- AI guesses conventions
- Inconsistent code generation

**Fix:** Add `CLAUDE.md` with explicit MUST ALWAYS/MUST NEVER rules.

*See: [AI Agents](04-ai-agents.md)*

---

### 4. Docs Live in Confluence, Not Repo

**Symptom:** Documentation and code diverge immediately.

**What it looks like:**
- "See Confluence for docs"
- Confluence docs are 6 months behind
- Code changed, docs didn't
- Nobody trusts the documentation

**Fix:** Docs in repo, versioned with code. Update both together.

---

### 5. No CHANGELOG

**Symptom:** Users don't know what changed between versions.

**What it looks like:**
- No version history
- Users surprised by breaking changes
- "What's new?" — Nobody knows

**Fix:** Maintain `CHANGELOG.md` following Keep a Changelog format.

*See: [Changelogs](06-changelogs.md)*

---

### 6. Outdated README

**Symptom:** Setup instructions don't work.

**What it looks like:**
- "npm install myapp" — package doesn't exist
- Build instructions reference old tools
- Users follow instructions, nothing works

**Fix:** Test instructions on fresh machine. Update with code changes.

---

### 7. Mixed Audiences

**Symptom:** README tries to serve users and developers simultaneously.

**What it looks like:**
- Starts with "What is this?" (for users)
- Then "How to build" (for developers)
- Nobody finds what they need

**Fix:** Separate user docs (`docs/user/`) and developer docs (`docs/dev/`).

*See: [Manifesto](00-manifesto.md)*

---

### 8. No Architecture Docs

**Symptom:** New developers read 50 files to understand the system.

**What it looks like:**
- No `docs/dev/architecture.md`
- No diagrams
- No explanation of design decisions
- Tribal knowledge

**Fix:** Write `docs/dev/architecture.md` with overview and diagrams.

---

### 9. No Contribution Guide

**Symptom:** Contributors don't know how to contribute.

**What it looks like:**
- No `CONTRIBUTING.md`
- PRs don't follow conventions
- Maintainers reject PRs for style issues
- Contributors give up

**Fix:** Write `CONTRIBUTING.md` with setup, conventions, and process.

---

### 10. No ADRs (Architecture Decision Records)

**Symptom:** "Why did we choose X?" — Nobody remembers.

**What it looks like:**
- No `docs/dev/decisions/`
- Decisions lost to time
- Same debates repeated
- Context lost when team changes

**Fix:** Document major decisions as they're made.

---

### 11. Tests Don't Pass on Main

**Symptom:** "Just run `npm test`" — 15 tests fail.

**What it looks like:**
- Flaky tests
- Tests depend on local setup
- Main branch is broken
- New contributors confused

**Fix:** Fix tests. Keep main green. Update docs if tests need setup.

---

### 12. No Examples

**Symptom:** API documented but no usage examples.

**What it looks like:**
- "Here's the API reference"
- No examples
- Users don't know how to use it

**Fix:** Add examples for common use cases.

---

### 13. Hidden Prerequisites

**Symptom:** Setup instructions assume you have X installed.

**What it looks like:**
- "Just run `npm start`"
- Fails because Node.js version is wrong
- Fails because database not set up
- Prerequisites not stated

**Fix:** List all prerequisites with version numbers.

---

### 14. README Doesn't Match Code

**Symptom:** Documentation describes old version.

**What it looks like:**
- "Run `npm start`" — script doesn't exist
- API examples use deprecated endpoints
- Screenshots show old UI

**Fix:** Update docs in same PR as code changes.

---

### 15. Copy-Paste from Another Repo

**Symptom:** Documentation references wrong project.

**What it looks like:**
- "Welcome to OtherProject"
- Links point to different repo
- Examples don't match codebase

**Fix:** Customize all documentation. Don't blindly copy.

---

## How to Spot These

**Signals:**
- New contributors ask same questions repeatedly
- Setup instructions don't work
- AI agents produce inconsistent code
- Documentation and code diverged
- Nobody references the docs

**Metrics:**
- Time to first contribution
- Number of "how do I..." questions
- PR rejection rate for style issues
- AI code quality (consistency)

---

**Next**: [Templates →](08-templates.md)
