# Writing for Human Developers

> "Developers need to know three things: how to start, how to contribute, and why things are the way they are."

## The Problem

Onboarding a new developer shouldn't require reading the entire codebase or asking the team lead 47 questions. Yet most repositories expect exactly that. The README has user-facing docs. The code has comments. There's nothing in between.

**Human developers need explicit documentation: setup, architecture, conventions, and how to contribute.**

---

## Who Human Developers Are

- People modifying the code
- Contributing features or fixes
- Maintaining the system
- Debugging production issues
- Maybe external (open source) or internal (team members)

---

## What Developers Need

### 1. Development Environment Setup

Exact steps to go from git clone to running tests:

```markdown
## Development Setup

**Prerequisites:**
- Node.js 20+
- PostgreSQL 15+
- Docker (for integration tests)

**Steps:**
1. Clone: `git clone https://github.com/org/repo`
2. Install: `npm install`
3. Configure: `cp .env.example .env` (edit DATABASE_URL)
4. Database: `npm run db:setup`
5. Tests: `npm test` (should pass)
6. Start: `npm run dev` (http://localhost:3000)
```

**Test this on a fresh machine. If it doesn't work, fix it.**

### 2. Architecture Overview

High-level system design:

```markdown
## Architecture

### Stack
- Frontend: React + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL
- Cache: Redis
- Queue: BullMQ

### Directory Structure
```
src/
  api/        # HTTP endpoints
  services/   # Business logic
  models/     # Database models
  jobs/       # Background jobs
  utils/      # Shared utilities
```

### Data Flow
User → API → Service → Database
Service → Job Queue → Background Worker
```

**Enough to orient, not exhaustive.**

### 3. How to Contribute

The CONTRIBUTING.md contract:

```markdown
## How to Contribute

### Before You Start
- Check existing issues
- Discuss major changes first (open an issue)

### Development Workflow
1. Fork and clone
2. Create branch: `git checkout -b feature/your-feature`
3. Make changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Commit: Follow [Conventional Commits](link)
7. Push and open PR

### Code Review Process
- All PRs need 1 approval
- CI must pass
- Update docs if needed
- Maintainer will merge
```

### 4. Coding Conventions

Explicit rules:

```markdown
## Coding Conventions

### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` if needed)
- Prefer `interface` over `type` for objects

### Naming
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Testing
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- Test file next to source file

### Imports
- Absolute imports: `@/services/user`
- Group: stdlib → external → internal
```

### 5. How to Run Tests

```markdown
## Testing

**Run all tests:**
npm test

**Run specific test:**
npm test user.test.ts

**Watch mode:**
npm test -- --watch

**Coverage:**
npm test -- --coverage
```

**Expected:** All tests pass on main branch.

### 6. Architecture Decision Records (ADRs)

Why things are the way they are:

```markdown
# ADR-001: Use PostgreSQL Instead of MongoDB

**Status:** Accepted  
**Date:** 2026-01-15  
**Deciders:** Engineering Team

## Context
We need a database for user data and transactions.

## Decision
Use PostgreSQL.

## Rationale
- Need transactions (user balance updates)
- Structured data fits relational model
- Team has PostgreSQL experience
- Strong TypeScript support (Prisma, TypeORM)

## Consequences
- Need to manage schema migrations
- More rigid schema changes
- Excellent query performance for our use case
```

*Place in docs/dev/decisions/*

---

## CONTRIBUTING.md Template

```markdown
# Contributing to [Project Name]

Thank you for considering contributing!

## Code of Conduct

[Link to CODE_OF_CONDUCT.md or state expectations]

## Development Setup

[Prerequisites and setup steps]

## How to Contribute

### Reporting Bugs
- Use the bug report template
- Include steps to reproduce
- Include system info

### Suggesting Features
- Use the feature request template
- Explain the use case
- Consider alternatives

### Contributing Code

**Before you start:**
- Check existing issues/PRs
- Discuss major changes first

**Development workflow:**
1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Write/update tests
5. Run tests: `npm test`
6. Run linter: `npm run lint`
7. Commit with clear message
8. Push and open a PR

**PR Requirements:**
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Linter passes
- [ ] All tests pass
- [ ] PR description explains what and why

## Code Style

[Link to conventions doc or summarize key points]

## Testing

[How to run tests, what's expected]

## Review Process

- PRs need 1 approval
- Maintainer will merge
- Expected review time: 2-3 business days

## Questions?

Open an issue or ask in [Slack/Discord/etc]
```

---

## docs/dev/ Structure

### setup.md

Detailed dev environment setup:
- Prerequisites with version numbers
- Installation steps (validated on clean machine)
- IDE setup (recommended extensions, settings)
- Troubleshooting common setup issues

### architecture.md

System design:
- High-level architecture diagram
- Component descriptions
- Data flow
- Key design patterns used
- External integrations

### testing.md

Test strategy:
- Test types (unit, integration, e2e)
- How to run each type
- How to write new tests
- Coverage expectations
- CI/CD test pipeline

### conventions.md

Code standards:
- Language-specific conventions
- Naming conventions
- File organization
- Comment guidelines
- Import order

### decisions/

ADRs for major decisions:
- Template for new ADRs
- One file per decision
- Numbered: `001-decision-name.md`
- Immutable (don't edit old ADRs, create new ones)

### runbooks/

Operational procedures:
- `deploy.md` — How to deploy
- `rollback.md` — How to roll back
- `monitor.md` — What to monitor
- `troubleshoot.md` — Common issues in production

---

## README Section for Developers

```markdown
## For Developers

**Development setup:** See [docs/dev/setup.md](docs/dev/setup.md)

**Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)

**Architecture:** See [docs/dev/architecture.md](docs/dev/architecture.md)

**Quick start:**
```bash
git clone https://github.com/org/repo
cd repo
npm install
npm test  # should pass
npm run dev
```
```

---

## Common Mistakes

### Mistake 1: "It's Obvious How to Build It"

No it's not. Spell it out.

**Fix:** Test setup instructions on a fresh machine.

### Mistake 2: No Architecture Docs

New developer reads 50 files to understand the system.

**Fix:** Create docs/dev/architecture.md with overview.

### Mistake 3: Implicit Conventions

Team uses conventions but they're not written down.

**Fix:** Write docs/dev/conventions.md. Reference in PRs.

### Mistake 4: No ADRs

"Why did we choose X?" — Nobody remembers.

**Fix:** Document decisions when you make them.

### Mistake 5: Setup Instructions Don't Work

Instructions were written once, never updated.

**Fix:** Test on clean machine. Update when changes happen.

---

## Checklist

Developer documentation must have:
- [ ] Development setup (step-by-step)
- [ ] How to run tests
- [ ] CONTRIBUTING.md (how to contribute)
- [ ] Architecture overview
- [ ] Coding conventions
- [ ] ADRs for major decisions
- [ ] Setup instructions work on fresh machine
- [ ] All tests pass on main branch

---

**Next**: [AI Agents →](04-ai-agents.md)
