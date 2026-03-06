# Maintenance and Lifecycle

> "Documentation is a love letter that you write to your future self."
> — Damian Conway

## The Problem

Documentation rot is inevitable. Code changes. Systems evolve. Teams reorganize. The documentation you write today will be wrong in six months — unless you actively maintain it.

Most teams write documentation once and abandon it. The result: outdated pages that mislead readers, broken links, and eroded trust. Eventually, people stop reading the documentation because they've learned it's unreliable.

**The hardest problem in documentation is not writing it — it's keeping it alive.**

---

## The Documentation Lifecycle

Documentation has three states:

### 1. Active

- Accurate and current
- Actively maintained
- Reviewed regularly
- Trusted by readers

### 2. Stale

- Partially outdated
- Unmaintained
- Review date passed
- Readers uncertain if they can trust it

### 3. Archived

- Deliberately marked as outdated
- Kept for historical reference
- Clearly labeled as archived
- Not discoverable in normal search

**The worst state is unstated staleness** — documentation that looks active but is actually outdated. This actively harms readers.

---

## Ownership

Every document needs an owner. Not a team. Not "everyone." One person who is responsible for:
- Keeping it current
- Reviewing it regularly
- Updating it when things change
- Archiving it when it's no longer relevant

### How to Assign Ownership

**At the top of every document:**
```markdown
**Last updated:** 2026-03-05 | **Owner:** Alice Chen | **Review:** Monthly
```

**Alternative (metadata block):**
```yaml
---
title: Deployment Guide
owner: alice.chen@company.com
last_updated: 2026-03-05
review_frequency: monthly
---
```

**The owner isn't necessarily the original author.** It's whoever is currently responsible for the system or topic.

### When Ownership Changes

- Team member leaves? Reassign before they go
- System changes ownership? Update the doc owner
- Owner no longer relevant to the topic? Find new owner or archive

**Unowned documentation is abandoned documentation.**

---

## Review Cadence

Documentation doesn't stay current by accident. It needs scheduled reviews.

### Review Frequency by Document Type

| Document Type | Review Frequency | Why |
|---|---|---|
| API Reference | Every release | APIs change frequently |
| Architecture Docs | Quarterly | Architecture changes slowly |
| Onboarding Guides | Monthly | High-traffic, high-impact |
| Runbooks | After each incident | Learn from operational changes |
| How-To Guides | Quarterly | Procedures evolve |
| Tutorials | Every major release | Breaking changes affect tutorials |
| Decision Records (ADRs) | Never (immutable) | Historical record |

### The Review Checklist

When reviewing a document, check:
- [ ] Is the information still accurate?
- [ ] Have there been system changes not reflected here?
- [ ] Are all links still working?
- [ ] Are screenshots still current?
- [ ] Are code examples still valid?
- [ ] Is the owner still correct?
- [ ] Is anything missing that should be added?
- [ ] Is anything here that should be removed?

**If nothing changed:** Update the "last reviewed" date anyway. This signals to readers that someone recently verified accuracy.

### Automated Review Reminders

Set up reminders:
- Calendar events for the owner
- GitHub Issues for quarterly reviews
- Slack/email reminders
- Documentation dashboard tracking review dates

**Example GitHub Action:**
```yaml
# .github/workflows/doc-review-reminder.yml
name: Documentation Review Reminder
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am
jobs:
  check-stale-docs:
    runs-on: ubuntu-latest
    steps:
      - name: Find docs over 90 days old
        run: |
          find docs/ -name "*.md" -mtime +90 -print
      - name: Create issue if stale docs found
        # ... create GitHub issue
```

---

## Staleness Detection

How do you know when documentation is stale?

### Signals of Staleness

1. **Time since last update**
   - 3+ months without update = possible staleness
   - 6+ months = likely stale
   - 12+ months = almost certainly stale

2. **Code changes without doc updates**
   - Major version release without doc update = stale
   - Breaking API changes without reference update = stale
   - Architecture changes without architecture doc update = stale

3. **Broken links**
   - Link to deleted page = stale
   - Link to moved resource = needs update

4. **Reader feedback**
   - Comments: "This doesn't work"
   - Issues: "Step 3 is missing"
   - Questions: "Is this still current?"

5. **Ownership changes**
   - Owner left the company = needs new owner
   - System ownership changed = doc needs review

### Automated Staleness Checks

**Link checkers:**
```bash
# Check for broken links
markdown-link-check docs/**/*.md
```

**File age checks:**
```bash
# Find docs not modified in 6+ months
find docs/ -name "*.md" -mtime +180
```

**Code-to-doc mapping:**
```bash
# Files changed since last doc update
git diff --name-only HEAD $(git log -1 --format=%H docs/api-guide.md) src/api/
```

### The Staleness Banner

If you can't update documentation immediately, add a staleness warning:

```markdown
> ⚠️ **This document may be outdated.** Last reviewed: 2025-08-15. 
> If you find inaccuracies, please [open an issue](link).
```

**Temporary honesty beats silent staleness.**

---

## Update Strategies

### 1. Update on Change

**When:** Whenever you change the code/system

**How:** Include doc updates in the same PR/MR as code changes

**Example process:**
```markdown
## PR Checklist
- [ ] Code changes implemented
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

**Pros:**
- Docs stay in sync with code
- Context is fresh (you just made the change)

**Cons:**
- Requires discipline
- Can slow down urgent fixes

### 2. Scheduled Review

**When:** Regular intervals (weekly, monthly, quarterly)

**How:** Calendar event, assigned owner reviews and updates

**Pros:**
- Catches drift over time
- Planned, not reactive

**Cons:**
- Can miss immediate changes
- Requires consistent follow-through

### 3. Triggered Review

**When:** Specific events occur

**Events that trigger reviews:**
- Major version release
- Breaking change
- Architecture change
- Incident (runbook update)
- Team member offboarding (ownership transfer)

**Pros:**
- Updates happen when most relevant

**Cons:**
- Easy to forget triggers
- Reactive, not proactive

**Best practice: Combine all three strategies.**

---

## Versioning

Should you version your documentation?

### When to Version

**Version documentation separately from code if:**
- Multiple versions of the product are in active use
- Users can't easily upgrade (embedded systems, mobile apps)
- Breaking changes require migration guides

**Example structure:**
```
docs/
  v1/
    api-reference.md
    migration-to-v2.md
  v2/
    api-reference.md
  current -> v2  (symlink)
```

### When NOT to Version

**Use a single "current" documentation set if:**
- Only one version is supported
- All users are on the latest version
- Documentation auto-deploys with releases

**In most internal tools: Don't version.** Maintain current docs only.

### Changelog as Alternative

Instead of versioning full docs, maintain a changelog:

```markdown
# API Changelog

## 2026-03-05 - v2.5.0
- Added: `GET /api/v1/health` endpoint
- Changed: `/api/v1/users` now returns pagination metadata
- Deprecated: `/api/v1/legacy-users` (use `/api/v1/users` instead)
- Removed: `/api/v1/old-endpoint` (deprecated since v2.3.0)
```

Follow [Keep a Changelog](https://keepachangelog.com/) format.

---

## Archival

When documentation is no longer relevant, archive it. Don't delete. Don't leave it active.

### When to Archive

- Feature removed from product
- System decommissioned
- Process no longer used
- Superseded by new documentation

### How to Archive

**Option 1: Move to archive directory**
```
docs/
  archive/
    old-api-guide.md
    legacy-deployment.md
  current/
    api-guide.md
    deployment.md
```

**Option 2: Add archived banner**
```markdown
---
archived: true
archived_date: 2026-03-05
superseded_by: new-api-guide.md
---

> ⚠️ **This document is archived.** It describes a system that no longer exists.
> See [New API Guide](new-api-guide.md) for current information.

# Old API Guide
...
```

**Option 3: Remove from search/nav but keep in git**
- Remove from index/navigation
- Keep file in repository (git history)
- Add redirect to new doc if applicable

**Never silently delete documentation.** Someone might link to it. Git history isn't enough — provide a clear signal.

---

## Documentation Debt

Like technical debt, documentation debt accumulates when:
- Updates are skipped ("We'll do it later")
- Shortcuts are taken ("Just this once")
- Ownership is unclear ("Someone will handle it")
- No review process exists

### Measuring Documentation Debt

Track these metrics:
- Number of docs past review date
- Number of broken links
- Number of unowned documents
- Time since last update per doc
- Reader feedback volume (questions, complaints)

**High doc debt = low doc trust.**

### Paying Down Documentation Debt

**1. Triage:**
- Critical docs (high-traffic, high-impact) → Fix first
- Medium docs → Schedule
- Low docs → Archive or delete

**2. Fix or Archive:**
- Can you update it in < 1 hour? Update it.
- Will it take days? Schedule dedicated time.
- Not worth the time? Archive it.

**3. Prevent New Debt:**
- Assign owners to all new docs
- Add review dates
- Include doc updates in PR checklists
- Review quarterly

**A small set of maintained docs beats a large set of abandoned ones.**

---

## The Maintenance Checklist

### For Every Document

- [ ] Owner assigned (specific person, not team)
- [ ] Review frequency stated
- [ ] Last updated date visible
- [ ] Links checked (no broken links)
- [ ] Reflects current system state
- [ ] Superseded docs linked or archived

### Quarterly Audit

- [ ] All docs reviewed or marked stale
- [ ] All owners still valid
- [ ] All links working
- [ ] All archives clearly marked
- [ ] No orphaned docs (unowned, unreferenced)

### Annual Purge

- [ ] Archive docs for deprecated systems
- [ ] Delete true duplicates (not just similar)
- [ ] Consolidate overlapping docs
- [ ] Update ownership for team changes

---

## Tools for Maintenance

### Link Checkers
- `markdown-link-check` — Check markdown links
- `linkchecker` — Check HTML links
- GitHub Actions link checker

### Staleness Detection
- `git log` + `find` — Find old files
- Custom scripts (last modified date)
- Documentation dashboards

### Documentation Dashboards
- Notion, Confluence analytics
- Custom dashboard (owner, review date, age)
- GitHub wiki analytics

---

## Checklist

Before marking a document "done":
- [ ] Owner assigned
- [ ] Review frequency set
- [ ] Last updated date visible
- [ ] Links verified
- [ ] Accurate as of today

Every quarter:
- [ ] Review all docs past review date
- [ ] Fix broken links
- [ ] Archive obsolete docs
- [ ] Reassign orphaned docs

---

**Next**: [Anti-Patterns Gallery →](06-anti-patterns.md)
