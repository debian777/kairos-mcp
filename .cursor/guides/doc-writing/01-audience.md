# Audience Analysis

> "If you're writing for everyone, you're writing for no one."
> — Ann Handley

## The Problem

The single biggest mistake in documentation: writing for the wrong audience. Most authors write for themselves — they document what *they* know in the way *they* think about it. The result: documentation that makes perfect sense to the author and confuses everyone else.

A system architect and a new hire need fundamentally different information. A calm researcher and someone troubleshooting a production incident have fundamentally different cognitive states. One document cannot serve both without failing both.

---

## The Three Questions

Before you write a single word, answer these:

### 1. Who will read this?

Not "anyone who might need it someday." Be specific:
- Job role? (Engineer, manager, executive, support, customer)
- Expertise level? (Beginner, intermediate, expert)
- Relationship to the system? (User, developer, operator, auditor)

**Good:** "Backend engineers who need to add a new API endpoint"
**Bad:** "People working with the API"

### 2. What do they already know?

Never assume. Never guess. List the prerequisite knowledge explicitly:
- Do they know the domain? (Is this their first day or their fifth year?)
- Do they know the technology? (Do you need to explain what Docker is?)
- Do they know your system? (Are they internal or external?)

**If you're writing for multiple audiences with different knowledge levels, you need multiple documents.**

### 3. What are they trying to accomplish?

People read documentation with a goal. What is it?
- **Learn** — Understand a concept or system
- **Do** — Complete a specific task
- **Decide** — Choose between options
- **Troubleshoot** — Fix a problem
- **Reference** — Look up specific information

Each goal needs a different document structure.

---

## The Cognitive State Spectrum

Your reader's mental state determines how they read.

### Calm Research

- **Context:** Exploring, learning, planning
- **Cognitive load:** Low
- **Time pressure:** Low
- **Reading style:** Sequential, thorough
- **What they need:** Context, explanation, trade-offs, examples
- **Document type:** Tutorial, guide, architecture overview

### Task Execution

- **Context:** Following a procedure
- **Cognitive load:** Medium
- **Time pressure:** Medium
- **Reading style:** Step-by-step scanning
- **What they need:** Clear steps, prerequisites, expected outcomes
- **Document type:** How-to, runbook, installation guide

### Active Troubleshooting

- **Context:** Something is broken, clock is ticking
- **Cognitive load:** High
- **Time pressure:** High
- **Reading style:** Desperate scanning for keywords
- **What they need:** Symptoms, causes, fixes — fast
- **Document type:** Troubleshooting guide, runbook, FAQ

**The same person in different states needs different documentation.** Write separate documents for separate states.

---

## Expertise Levels

### Beginner

- **Knows:** Nothing about your system (but may have domain expertise)
- **Needs:**
  - Definitions of all terms
  - Context for why things work the way they do
  - Step-by-step instructions with screenshots
  - Common pitfalls called out explicitly
  - Reassurance that they're on the right track
- **Avoid:** Jargon, assumptions, "obviously", "simply", "just"

### Intermediate

- **Knows:** The basics, has used the system
- **Needs:**
  - How to accomplish less common tasks
  - How components interact
  - Trade-offs between approaches
  - Troubleshooting for common issues
- **Avoid:** Repeating basics they already know, over-explaining

### Expert

- **Knows:** The system deeply, possibly better than you
- **Needs:**
  - Reference documentation (API docs, config options)
  - Edge cases and advanced usage
  - Performance characteristics
  - Internal architecture details
- **Avoid:** Explaining concepts they already understand, wasting their time

**If you try to write one document for all three levels, you'll satisfy none.**

---

## The Four Audience Archetypes

### The User

- **Goal:** Use the product/system to solve their problem
- **Cares about:** What it does, how to use it, troubleshooting
- **Doesn't care about:** How it works internally, implementation details
- **Document types:** README, user guide, FAQ, troubleshooting

### The Developer

- **Goal:** Build with, extend, or integrate the system
- **Cares about:** How to set up dev environment, architecture, APIs, contributing
- **Doesn't care about:** End-user features (unless they're building them)
- **Document types:** CONTRIBUTING.md, API docs, architecture docs, ADRs

### The Operator

- **Goal:** Deploy, monitor, and maintain the system in production
- **Cares about:** Deployment, configuration, monitoring, troubleshooting, disaster recovery
- **Doesn't care about:** Development workflows, code structure
- **Document types:** Runbooks, deployment guides, incident response, monitoring setup

### The Decision-Maker

- **Goal:** Decide whether to adopt/buy/use the system
- **Cares about:** What problem it solves, trade-offs, cost, risk
- **Doesn't care about:** Implementation details, how to use it (yet)
- **Document types:** README (the pitch section), architecture overview, decision documents

**Most repositories only document one of these. Great repositories document all four in separate, purpose-built documents.**

---

## The Audience-Document Matrix

| Document Type | Primary Audience | Cognitive State | Expertise Assumed |
|---|---|---|---|
| README | User, Decision-Maker | Calm research | Beginner |
| Tutorial | User, Developer | Calm research | Beginner |
| How-To Guide | User, Developer, Operator | Task execution | Intermediate |
| API Reference | Developer | Task execution | Intermediate-Expert |
| Architecture Doc | Developer, Decision-Maker | Calm research | Intermediate |
| Troubleshooting Guide | User, Operator | Active troubleshooting | Any |
| Runbook | Operator | Active troubleshooting | Intermediate |
| ADR (Decision Record) | Developer, Decision-Maker | Calm research | Intermediate-Expert |
| FAQ | User | Task execution / Troubleshooting | Beginner-Intermediate |

---

## The Empathy Test

Before publishing, answer these:

1. **Would a complete beginner understand this?** (If this doc is for beginners)
2. **Would an expert skip to the information they need in 10 seconds?** (If this doc is for experts)
3. **Would someone troubleshooting at 2am find the answer?** (If this doc is for troubleshooting)
4. **Would someone evaluating the system know if it's right for them?** (If this doc is a pitch)

If any answer is "no" — and the document is supposed to serve that audience — rewrite.

---

## Common Mistakes

### Mistake 1: Writing for Yourself

You wrote the code. You understand the system. Your documentation assumes the reader shares your mental model. They don't.

**Fix:** Have someone from the target audience review it. Watch them use it. Where do they get confused?

### Mistake 2: The "Everyone" Audience

"This is for anyone who needs to understand the authentication system."

That's not an audience. That's a cop-out. A beginner developer, a security auditor, and a front-end engineer integrating the login flow need completely different information.

**Fix:** Pick one primary audience per document. Write separate documents for separate audiences.

### Mistake 3: Assuming Prerequisite Knowledge Without Stating It

"To deploy, configure the ingress controller."

What's an ingress controller? Where do I configure it? How?

**Fix:** State prerequisites explicitly at the top. Link to foundational docs if needed.

### Mistake 4: Mixing Cognitive States

Your tutorial starts with careful explanation, then suddenly jumps to "Obviously, you'll need to configure the load balancer" with no instructions.

**Fix:** Stay consistent within a document. If you're in "calm research" mode, stay there. If you're in "task execution" mode, give complete steps.

### Mistake 5: Not Testing With Real Readers

You think your documentation is clear. You wrote it. Of course it's clear *to you*.

**Fix:** Watch someone from the target audience try to use it. Don't help. Don't explain. Just observe. Their confusion is your signal.

---

## Checklist

Before writing:
- [ ] I can state the primary audience in one sentence
- [ ] I know their expertise level
- [ ] I know their cognitive state (calm research / task execution / troubleshooting)
- [ ] I know what they're trying to accomplish
- [ ] I've listed prerequisite knowledge explicitly
- [ ] I've chosen one audience (or I'm writing multiple documents)

Before publishing:
- [ ] Someone from the target audience has reviewed it
- [ ] Prerequisite knowledge is stated at the top
- [ ] Jargon is defined on first use (if audience is beginner)
- [ ] The document serves one audience, not "everyone"

---

**Next**: [Structure and Information Architecture →](02-structure.md)
