# The Git Repository Documentation Manifesto

> "A repository documented for one audience serves no audience well."

## The Problem

Most repositories have a README. Some have a CONTRIBUTING.md. Few have both. Almost none have AI-specific documentation. The result: three audiences (end users, human developers, AI agents) stumbling through documentation written for someone else.

**The user** opens the README and finds build instructions. They just wanted to know what the software does.

**The developer** opens the README and finds a marketing pitch. They needed to know how to run tests.

**The AI agent** reads vague instructions ("configure the system appropriately") and hallucinates. It needed explicit, unambiguous steps.

The problem isn't that repositories lack documentation. The problem is that repositories lack documentation *for the right audiences*.

---

## The Core Belief

A git repository serves three fundamentally different audiences, each with different goals, different mental models, and different needs:

1. **End Users** — People who want to *use* the software
2. **Human Developers** — People who want to *modify* the code
3. **AI Agents** — Assistants that need *unambiguous* instructions to help effectively

One README cannot serve all three. Trying creates a confused mess that serves none.

---

## The Three Audiences

### End Users

**Who they are:**
- People installing and using your software
- Zero knowledge of the codebase
- May not be technical at all

**What they need:**
- What does this software do?
- Why would I use it?
- How do I install it?
- How do I use it?
- What do I do when it breaks?

**What they don't need:**
- Build instructions
- Development setup
- Architecture decisions
- Code conventions

**Documents for end users:**
- README.md (what and why section)
- CHANGELOG.md
- docs/user/

### Human Developers

**Who they are:**
- People modifying the code
- Contributing new features or fixes
- Maintaining the system

**What they need:**
- How do I set up a dev environment?
- How do I run tests?
- What are the coding conventions?
- How do I submit changes?
- How is the system architected?
- Why was it built this way?

**What they don't need:**
- End-user installation instructions (they're building from source)
- Marketing pitch (they're already here)

**Documents for developers:**
- README.md (quick start section)
- CONTRIBUTING.md
- docs/dev/
  - architecture.md
  - decisions/ (ADRs)
  - setup.md

### AI Agents

**Who they are:**
- Claude, Cursor, GitHub Copilot, etc.
- Assistants that read code and documentation
- Generate, modify, and explain code

**What they need:**
- Unambiguous, structured instructions
- Explicit rules (MUST ALWAYS / MUST NEVER)
- System architecture and file organization
- Coding conventions and patterns
- Zero-drift instructions (no interpretation, no guessing)

**What they don't need:**
- Marketing copy
- Vague language ("configure appropriately", "handle as needed")
- Human-oriented explanations

**Documents for AI:**
- CLAUDE.md (root-level AI context)
- AGENTS.md (per-directory AI instructions)
- .cursor/rules/ (Cursor-specific)
- docs/ai/ (detailed context)

---

## The Commandments

### I. Document for All Three Audiences or State Which You're Serving

If your repository serves end users, document for end users. If it's an internal tool for developers only, document for developers. If you use AI assistants, document for AI.

**But state your choice clearly.** Don't write a README that *looks* like it's for users but is actually for developers.

**Bad:**
```markdown
# MyApp

A comprehensive solution for data processing.

## Build
npm install && npm build
```
*(Is this for users or developers? Unclear.)*

**Good (user-focused):**
```markdown
# MyApp

Process large datasets 10x faster than Excel.

## Installation
Download the installer: [myapp.com/download](...)
```

**Good (developer-focused):**
```markdown
# MyApp

Internal data processing service for the analytics team.

**This is not end-user software. Documentation is for developers only.**

## Development Setup
npm install && npm start
```

### II. Separate Concerns — Don't Mix Audiences in One Document

A README that tries to serve users AND developers serves neither well. Separate:
- User documentation: README (what/why), docs/user/
- Developer documentation: CONTRIBUTING, docs/dev/
- AI documentation: CLAUDE.md, docs/ai/

**Use the README as a routing document:**
```markdown
# MyApp

[What it does and why]

## For Users
- [Installation Guide](docs/user/installation.md)
- [User Manual](docs/user/manual.md)

## For Developers
- [Development Setup](docs/dev/setup.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Architecture](docs/dev/architecture.md)
```

### III. Lead with Purpose, Not Implementation

End users don't care that it's "a containerized microservice built with FastAPI and PostgreSQL." They care that it "processes invoices 10x faster."

Developers don't care about the marketing pitch. They care about the tech stack, architecture, and how to contribute.

**Put the right information first for each audience.**

### IV. Make Setup Obvious for Each Audience

**For users:**
```markdown
## Installation

**macOS:**
brew install myapp

**Windows:**
Download the installer: [link]

**Linux:**
snap install myapp
```

**For developers:**
```markdown
## Development Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Start dev server: `npm start`
```

**For AI:**
```markdown
## AI Instructions

**MUST ALWAYS:**
- Run `npm test` before committing
- Use TypeScript strict mode
- Follow file naming: `kebab-case.ts`
```

### V. Version Your Changelog, Not Your README

The README describes the current state. The CHANGELOG describes what changed.

Don't put version history in the README. Put it in CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format.

### VI. Write for AI Like You're Writing for a Literal Interpreter

AI agents read literally. Ambiguity causes drift, not interpretation.

**Bad (for AI):**
```markdown
Configure the database as appropriate.
```
*(What's "appropriate"? AI will guess.)*

**Good (for AI):**
```markdown
Set DATABASE_URL environment variable to PostgreSQL connection string.
Format: postgresql://user:pass@host:port/db
```

**For AI documentation:**
- Use imperative verbs (validate, throw, return)
- Avoid hedging (might, could, should, consider)
- Provide explicit examples
- Use MUST ALWAYS / MUST NEVER lists

*See: [AI Agents](04-ai-agents.md)*

### VII. Treat CONTRIBUTING.md as a Contract

CONTRIBUTING.md is the contract between maintainers and contributors. It must answer:
- How do I set up a dev environment?
- How do I run tests?
- What are the code conventions?
- How do I submit changes?
- How will my contribution be reviewed?

If any of these are unclear, contributors will guess — and guess wrong.

*See: [Human Developers](03-human-devs.md)*

### VIII. Keep Documentation in the Repository

Documentation that lives in Confluence, Notion, or Google Docs falls out of sync with code. Documentation in the repository can be:
- Versioned with the code
- Reviewed in pull requests
- Deployed with releases
- Found by developers

**Exception:** End-user docs that need to be public-facing (marketing site, support portal) can live elsewhere, but keep a README in the repo.

### IX. Use Templates to Ensure Consistency

Every repository needs:
- README.md
- CONTRIBUTING.md (if accepting contributions)
- CHANGELOG.md (if releasing versions)
- CLAUDE.md (if using AI assistants)

Use templates. Don't reinvent from scratch.

*See: [Templates](08-templates.md)*

### X. Maintain or Remove — Never Abandon

Outdated documentation is worse than no documentation. It misleads and erodes trust.

Either:
- Commit to keeping it current (assign owner, set review schedule)
- Mark it as archived (clear "this is outdated" banner)
- Delete it (if it's truly not needed)

**Never leave documentation in the "abandoned but discoverable" state.**

*See: [Generic Guide — Maintenance](../doc-writing/05-maintenance.md)*

---

## The Three-Audience Test

Before pushing documentation, verify:

### End User Test (30 seconds)
- [ ] Can someone unfamiliar tell what this software does?
- [ ] Can they figure out how to install it?
- [ ] Do they know where to find help?

### Developer Test (5 minutes)
- [ ] Can a new contributor set up a dev environment?
- [ ] Do they know how to run tests?
- [ ] Do they know the contribution process?

### AI Test (Zero ambiguity)
- [ ] Are all instructions explicit (no "configure appropriately")?
- [ ] Are rules stated as MUST ALWAYS / MUST NEVER?
- [ ] Are examples provided for complex concepts?

If any test fails, the documentation for that audience is incomplete.

---

## What Great Repository Documentation Looks Like

```
myrepo/
├── README.md              # What, why, install (users) + quick start (devs)
├── CHANGELOG.md           # Version history (users + devs)
├── CONTRIBUTING.md        # How to contribute (devs)
├── CLAUDE.md              # AI context (AI agents)
├── docs/
│   ├── user/              # User guides
│   │   ├── installation.md
│   │   ├── getting-started.md
│   │   └── faq.md
│   ├── dev/               # Developer docs
│   │   ├── setup.md
│   │   ├── architecture.md
│   │   ├── testing.md
│   │   └── decisions/     # ADRs
│   └── ai/                # AI context (optional, for complex repos)
│       ├── architecture.md
│       └── conventions.md
└── .github/
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md
```

**Each audience knows where to find what they need.**

---

## Common Mistakes

### Mistake 1: One README to Rule Them All

Trying to serve all three audiences in one README creates a confused mess.

**Fix:** README as router + separate docs per audience.

### Mistake 2: Developer Docs Only

"It's obvious how to use it" — said the person who built it.

**Fix:** Write for users who don't know the code.

### Mistake 3: No AI Context

AI agents read your code but lack context. They guess. They hallucinate.

**Fix:** Add CLAUDE.md with explicit architecture and rules.

### Mistake 4: Docs Live in Confluence

Confluence docs and code diverge immediately.

**Fix:** Docs in repo, versioned with code.

### Mistake 5: README is Outdated

Installed the way it says in the README. It doesn't work. Trust eroded.

**Fix:** Update docs in same PR as code changes. Or delete outdated sections.

---

## The Single Metric

> Can someone from each audience accomplish their first goal in under 5 minutes?

- **User:** Install and run the software
- **Developer:** Set up dev environment and run tests
- **AI:** Understand codebase structure and conventions

If any audience can't — your documentation has failed them.

---

**Next**: [Documentation Architecture →](01-architecture.md)
