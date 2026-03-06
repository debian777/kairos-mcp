# Documentation Architecture

> "The structure of your documentation reflects the care you've taken with your project."

## The Problem

Most repositories grow documentation organically: a README here, a wiki page there, some docs in Confluence. The result: information scattered, duplicated, or lost. Nobody knows where anything is.

Great repository documentation needs structure. Not rigid bureaucracy — practical organization that helps each audience find what they need.

---

## The Recommended Structure

```
repository-root/
├── README.md                    # Overview + routing (all audiences)
├── CHANGELOG.md                 # Version history (users + devs)
├── CONTRIBUTING.md              # Contribution guide (devs)
├── LICENSE                      # Legal (all audiences)
├── CLAUDE.md                    # AI context (AI agents)
├── AGENTS.md                    # AI instructions (AI agents, optional)
│
├── docs/                        # All documentation
│   ├── user/                    # End-user documentation
│   │   ├── index.md
│   │   ├── installation.md
│   │   ├── getting-started.md
│   │   ├── user-guide.md
│   │   ├── troubleshooting.md
│   │   └── faq.md
│   │
│   ├── dev/                     # Developer documentation
│   │   ├── index.md
│   │   ├── setup.md             # Development environment
│   │   ├── architecture.md      # System design
│   │   ├── testing.md           # Test strategy
│   │   ├── conventions.md       # Code style, patterns
│   │   ├── decisions/           # ADRs
│   │   │   ├── 001-use-postgres.md
│   │   │   ├── 002-event-sourcing.md
│   │   │   └── template.md
│   │   └── runbooks/            # Operational procedures
│   │       ├── deploy.md
│   │       └── rollback.md
│   │
│   └── ai/                      # AI agent context (optional)
│       ├── index.md
│       ├── architecture.md      # Detailed system map for AI
│       ├── conventions.md       # Explicit coding rules
│       └── workflows.md         # Development workflows
│
├── .github/                     # GitHub-specific
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/               # CI/CD (not docs, but FYI)
│
└── .cursor/                     # Cursor-specific (AI)
    └── rules/
        ├── project-rules.md
        └── file-specific-rules.md
```

---

## Root-Level Files

### README.md

**Purpose:** The entry point. Answers "What is this?" and routes to detailed docs.

**Audience:** All three (users, devs, AI)

**Must contain:**
- Project name and one-sentence description
- What it does (for users)
- Quick start (for users)
- Development setup link (for devs)
- Links to detailed docs

**Should NOT contain:**
- Everything (keep it under 500 lines)
- Detailed architecture (link to docs/dev/)
- Full API reference (link to docs/)
- Version history (use CHANGELOG.md)

*See: [README Deep Dive](05-readmes.md)*

### CHANGELOG.md

**Purpose:** Version history and what changed.

**Audience:** Users + developers

**Format:** Follow [Keep a Changelog](https://keepachangelog.com/)

**Must contain:**
- All releases in reverse chronological order
- Categories: Added, Changed, Deprecated, Removed, Fixed, Security
- Version numbers and dates

*See: [Changelogs and Versioning](06-changelogs.md)*

### CONTRIBUTING.md

**Purpose:** How to contribute code, docs, or issues.

**Audience:** Human developers

**Must contain:**
- How to set up dev environment
- How to run tests
- Code conventions
- How to submit PRs
- Review process

*See: [Human Developers](03-human-devs.md)*

### LICENSE

**Purpose:** Legal terms for using the software.

**Audience:** All (especially users and legal teams)

**Options:**
- MIT (permissive)
- Apache 2.0 (permissive with patent grant)
- GPL-3.0 (copyleft)
- Proprietary (internal/commercial)

Choose a standard license. Don't write your own.

### CLAUDE.md

**Purpose:** AI agent context and instructions.

**Audience:** AI agents (Claude, Cursor, Copilot)

**Must contain:**
- What the repository is
- Architecture overview
- Coding conventions
- File organization
- Explicit rules (MUST ALWAYS / MUST NEVER)

**Format:** Zero-drift template (imperative, unambiguous)

*See: [AI Agents](04-ai-agents.md)*

### AGENTS.md (Optional)

**Purpose:** Alternative or supplementary AI instructions.

**Usage:**
- Some teams use CLAUDE.md for Claude-specific context
- AGENTS.md for generic AI instructions
- Or AGENTS.md in subdirectories for module-specific rules

**Not required if CLAUDE.md covers everything.**

---

## docs/ Directory Structure

### Why docs/?

- Keeps root clean
- Organizes by audience
- Scales as documentation grows
- Clear separation of concerns

### docs/user/

**Purpose:** End-user documentation (people using the software).

**Common files:**
- `index.md` — User docs home
- `installation.md` — How to install
- `getting-started.md` — First steps
- `user-guide.md` — Complete usage guide
- `troubleshooting.md` — Common problems and solutions
- `faq.md` — Frequently asked questions

**Optional:**
- `tutorials/` — Step-by-step guides
- `screenshots/` — UI images (if GUI application)

### docs/dev/

**Purpose:** Developer documentation (people modifying the code).

**Common files:**
- `index.md` — Developer docs home
- `setup.md` — Development environment setup
- `architecture.md` — System design overview
- `testing.md` — Test strategy and how to run tests
- `conventions.md` — Code style, naming, patterns
- `decisions/` — Architecture Decision Records (ADRs)
- `runbooks/` — Operational procedures (deploy, monitor, troubleshoot)

**Optional:**
- `api/` — Internal API documentation
- `database/` — Schema and migration docs
- `integrations/` — Third-party service integration docs

### docs/ai/ (Optional)

**Purpose:** Detailed AI agent context.

**When to use:**
- Complex repositories (multiple services, languages)
- Explicit architecture mapping for AI
- Detailed coding rules beyond what fits in CLAUDE.md

**Common files:**
- `index.md` — AI docs home
- `architecture.md` — Detailed system map
- `conventions.md` — Explicit coding rules
- `workflows.md` — Development workflows (branch strategy, CI/CD)

**If your CLAUDE.md is under 200 lines and covers everything, you don't need docs/ai/.**

---

## GitHub-Specific Files (.github/)

### Issue Templates

**Purpose:** Standardize bug reports and feature requests.

**Location:** `.github/ISSUE_TEMPLATE/`

**Files:**
- `bug_report.md` — Bug report template
- `feature_request.md` — Feature request template
- `config.yml` — Template configuration

**Why:** Ensures reporters provide necessary information.

### Pull Request Template

**Purpose:** Checklist for PR authors.

**Location:** `.github/PULL_REQUEST_TEMPLATE.md`

**Must contain:**
- What changed (summary)
- Why it changed (context)
- How to test
- Checklist (tests added, docs updated, etc.)

**Why:** Ensures PRs are complete before review.

---

## Cursor-Specific Files (.cursor/)

### .cursor/rules/

**Purpose:** Cursor-specific AI rules.

**Location:** `.cursor/rules/`

**Files:**
- `project-rules.md` — Project-wide rules
- `frontend-rules.md` — Frontend-specific (if applicable)
- `backend-rules.md` — Backend-specific

**Format:** Similar to CLAUDE.md but Cursor-specific.

**Why:** Cursor reads these files automatically.

---

## File Naming Conventions

### Markdown Files

- Use lowercase
- Use hyphens (kebab-case): `getting-started.md`
- Descriptive names: `architecture.md` not `arch.md`

### Directories

- Use lowercase
- Use hyphens: `issue-template/`
- Singular or plural consistently

### Special Files

- All caps for root-level convention files: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`
- Mixed case for GitHub convention: `.github/PULL_REQUEST_TEMPLATE.md`

---

## Cross-Linking Strategy

### README as Router

The README should link to:
- `docs/user/` for users
- `docs/dev/` for developers
- `CONTRIBUTING.md` for contributors
- `CLAUDE.md` (or not mention it — AI finds it automatically)

**Example:**

```markdown
## Documentation

- **Users:** See [User Guide](docs/user/index.md)
- **Developers:** See [Development Guide](docs/dev/index.md)
- **Contributors:** See [CONTRIBUTING.md](CONTRIBUTING.md)
```

### Index Pages

Every `docs/` subdirectory should have an `index.md` that:
- Explains what's in this section
- Links to all documents in the section
- Provides reading order if relevant

**Example:**

```markdown
# Developer Documentation

- [Setup](setup.md) — Set up your development environment
- [Architecture](architecture.md) — System design overview
- [Testing](testing.md) — How to write and run tests
- [Conventions](conventions.md) — Code style and patterns
```

### Relative Links

Use relative links for internal docs:
```markdown
[Architecture](../dev/architecture.md)
```

Not absolute:
```markdown
[Architecture](https://github.com/org/repo/blob/main/docs/dev/architecture.md)
```

**Why:** Relative links work locally, in PRs, and in different forks.

---

## Scaling Patterns

### Small Repository (< 10 files)

```
README.md
CONTRIBUTING.md
CHANGELOG.md
CLAUDE.md
```

No `docs/` directory needed. Everything in root.

### Medium Repository (10-50 files)

```
README.md
CONTRIBUTING.md
CHANGELOG.md
CLAUDE.md
docs/
  user/
  dev/
```

Add `docs/` with user and dev separation.

### Large Repository (50+ files, multiple services)

```
README.md
CONTRIBUTING.md
CHANGELOG.md
CLAUDE.md
docs/
  user/
  dev/
  ai/
  architecture/
  services/
    service-a/
    service-b/
```

Add `docs/ai/`, split architecture, per-service docs.

### Monorepo

```
README.md (root overview)
CONTRIBUTING.md (root)
CLAUDE.md (root)
packages/
  package-a/
    README.md
    CLAUDE.md
    docs/
  package-b/
    README.md
    CLAUDE.md
    docs/
```

Each package has its own docs. Root README links to packages.

---

## What NOT to Include

### Don't Put in Docs:

- Generated files (API docs, code coverage) → Use CI to generate and publish elsewhere
- Large binary files (videos, huge images) → Use external hosting (YouTube, CDN)
- Secrets or credentials → Use secrets management, never commit
- IDE-specific files (.vscode/, .idea/) → Use `.gitignore`

### Don't Duplicate:

- Architecture in both README and docs/dev/architecture.md → Pick one, link to it
- Setup instructions in both CONTRIBUTING.md and docs/dev/setup.md → Pick one
- Rules in both CLAUDE.md and docs/ai/ → CLAUDE.md for summary, docs/ai/ for details

**Single source of truth per topic.**

---

## Migration Strategy

**If you have existing unstructured docs:**

1. **Audit:** List all existing documentation
2. **Categorize:** Which audience is each doc for?
3. **Consolidate:** Merge duplicates
4. **Organize:** Move to the recommended structure
5. **Update links:** Fix all references
6. **Archive old:** Mark old wiki/Confluence as "See repo docs instead"

**Do it in phases:**
- Phase 1: Create structure, move critical docs
- Phase 2: Fill gaps
- Phase 3: Polish and link everything

---

## Checklist

Setting up a new repository:
- [ ] README.md (what, why, quick start, links)
- [ ] CONTRIBUTING.md (if accepting contributions)
- [ ] CHANGELOG.md (if releasing versions)
- [ ] LICENSE
- [ ] CLAUDE.md (if using AI assistants)
- [ ] docs/user/ (if end-user software)
- [ ] docs/dev/ (if team > 1 person)
- [ ] .github/PULL_REQUEST_TEMPLATE.md

Organizing existing repository:
- [ ] Create docs/ directory
- [ ] Separate user and dev docs
- [ ] Update README to link to docs/
- [ ] Add CLAUDE.md for AI context
- [ ] Fix all cross-links
- [ ] Archive old wiki/Confluence

---

**Next**: [End Users →](02-end-users.md)
