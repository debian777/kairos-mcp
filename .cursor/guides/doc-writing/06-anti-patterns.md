# Anti-Patterns Gallery

> "Every failure mode has a name. Once you can name it, you can fix it."

## The Problem

Most documentation fails in predictable ways. Recognizing these patterns helps you avoid them — or fix them when you inevitably create them.

---

## 1. Documentation Debt

**Symptom:** Documentation exists but is outdated, incomplete, or abandoned.

**What it looks like:**
- "Last updated: 2 years ago"
- Broken links throughout
- Instructions that don't work
- Unowned documents
- Readers constantly asking "Is this still current?"

**Why it happens:**
- No assigned owner
- No review process
- Doc updates not part of development workflow
- "We'll update the docs later" (never happens)

**How to fix:**
- Assign owners to all documents
- Set review cadence
- Add doc updates to PR checklist
- Archive what you can't maintain
- **Small set of maintained docs > large set of abandoned docs**

**Prevention:**
- Make maintenance part of the culture
- Track doc age/staleness
- Quarterly doc audits

*See: [Maintenance and Lifecycle](05-maintenance.md)*

---

## 2. Write-Once-Abandon

**Symptom:** Documentation created once, never touched again.

**What it looks like:**
- Created during initial project setup
- Never updated as system evolved
- Full of inaccuracies
- Team ignores it because they know it's wrong

**Why it happens:**
- Documentation seen as "checkbox to tick" not "living artifact"
- No ownership assignment
- No culture of maintenance
- Effort put into initial write, zero into updates

**How to fix:**
- Assign owner immediately
- Schedule first review within 30 days
- Tie docs to code changes (update both together)
- Delete or archive if you can't maintain

**Prevention:**
- Treat docs as code (review, test, maintain)
- Documentation in same repo as code
- CI checks for doc freshness

---

## 3. Documentation Sprawl

**Symptom:** Information scattered across too many places.

**What it looks like:**
- Confluence + GitHub wiki + README + Google Docs + Notion + Slack
- Same information in multiple places (all slightly different)
- Nobody knows where the truth is
- "Check the wiki. Or was it Confluence? Maybe Slack?"

**Why it happens:**
- No single source of truth decision
- Different tools for different teams
- Historical accumulation
- "We'll migrate it all later" (never happens)

**How to fix:**
- Choose ONE primary location per topic
- Migrate or delete duplicates
- Mark secondary locations as "See [primary location]"
- Enforce single-source-of-truth rule going forward

**Prevention:**
- Establish documentation strategy upfront
- Single platform per documentation type
- Clear guidelines: "Where does X go?"

---

## 4. Tribal Knowledge Syndrome

**Symptom:** Critical information exists only in people's heads or Slack history.

**What it looks like:**
- "Ask Sarah, she knows how this works"
- Slack threads as de facto documentation
- New team members struggle (no onboarding docs)
- Same questions asked repeatedly

**Why it happens:**
- Documentation seen as extra work
- "It's faster to just answer in Slack"
- No incentive to write things down
- Implicit knowledge not visible until someone leaves

**How to fix:**
- When answering in Slack, immediately document it
- Create FAQ from common questions
- Require documentation for all new systems
- Make "document this" part of code review

**Prevention:**
- Documentation is part of delivery (not extra)
- Template for "How does this work?"
- Reward good documentation writing

---

## 5. The README is the Only Doc

**Symptom:** Everything crammed into README.md.

**What it looks like:**
- 5000-line README
- Mix of quick start + architecture + API reference + troubleshooting
- Impossible to scan
- Readers give up

**Why it happens:**
- Easy to add to existing file
- No clear docs structure
- "We'll split it up later"
- Fear of creating too many files

**How to fix:**
- Extract major sections to separate files
- Keep README as entry point (overview + links)
- Create docs/ directory with organized structure
- One document, one purpose

**Prevention:**
- Start with docs/ directory upfront
- README is index, not encyclopedia
- Template for multi-doc structure

*See: [Git Repository Documentation Guide](../git-docs/INDEX.md)*

---

## 6. Assumed Knowledge

**Symptom:** Documentation assumes reader knows things they don't.

**What it looks like:**
- "Simply configure the ingress controller"
- No explanation of what ingress controller is
- No link to setup instructions
- "Obviously you'll need to..."

**Why it happens:**
- Author has curse of knowledge
- Writing for themselves, not the reader
- No testing with actual target audience

**How to fix:**
- State prerequisites explicitly
- Define jargon on first use
- Link to foundational concepts
- Have someone from target audience review

**Prevention:**
- Explicit audience statement at top
- Prerequisites section
- Test with actual beginners

*See: [Audience Analysis](01-audience.md)*

---

## 7. The Exhaustive Encyclopedia

**Symptom:** Documentation tries to cover every possible detail, edge case, and scenario.

**What it looks like:**
- Massive documents (thousands of lines)
- "Just in case" information everywhere
- Important information buried in noise
- Readers can't find the common path

**Why it happens:**
- Fear of leaving something out
- No prioritization (everything seems important)
- Writing for the 1% case, not the 99% case

**How to fix:**
- Cut 50% of content
- Move edge cases to separate "Advanced" doc
- Use progressive disclosure (summary → details → deep dive)
- Lead with common path, link to exceptions

**Prevention:**
- One document, one purpose
- Progressive disclosure from the start
- Regular pruning

*See: [Structure](02-structure.md)*

---

## 8. Death by Screenshots

**Symptom:** Documentation is mostly screenshots with minimal text.

**What it looks like:**
- 20 screenshots of UI flows
- Minimal explanation
- Screenshots out of date after every UI change
- Not searchable (text in images)
- Not accessible (screen readers can't read images)

**Why it happens:**
- "A picture is worth a thousand words"
- Faster to screenshot than write
- Assumes reader can infer from images

**How to fix:**
- Use text for instructions
- Screenshots only for clarification
- Alt text on all images
- Version or date screenshots

**Prevention:**
- Text first, images second
- Screenshots for complex UI only
- Plan for screenshot maintenance

---

## 9. The Meeting Dump

**Symptom:** Meeting notes dumped into documentation without curation.

**What it looks like:**
- Raw brainstorm notes marked as "documentation"
- No clear decisions
- No clear actions
- Chronological (not logical) organization

**Why it happens:**
- "Better than nothing"
- No time to curate after meeting
- Confusing meeting notes with documentation

**How to fix:**
- Extract decisions → decision document
- Extract actions → task tracker
- Extract knowledge → proper documentation
- Archive raw notes separately

**Prevention:**
- Meeting notes ≠ documentation
- Assign someone to extract decisions/actions
- Template for decision documents

---

## 10. Documentation Theatre

**Symptom:** Documentation exists to check a box, not to actually help readers.

**What it looks like:**
- "See attached document" (no document attached)
- Auto-generated docs never reviewed
- Required by process but nobody reads it
- Focuses on what's easy to measure, not what's useful

**Why it happens:**
- Compliance requirement without enforcement
- Measuring "did they write docs" not "are docs useful"
- No user testing
- No reader feedback loop

**How to fix:**
- Measure usefulness, not existence
- Test with real readers
- Track: Did this doc answer the question?
- Remove docs nobody uses

**Prevention:**
- User testing as part of doc review
- Measure impact (time saved, questions answered)
- Culture of "docs must be useful"

---

## 11. The Ghost Writer

**Symptom:** No author, no owner, no accountability.

**What it looks like:**
- No name on document
- No "last updated" date
- No way to ask questions
- No way to know if it's still current

**Why it happens:**
- Copy-pasted from elsewhere
- Team document (nobody owns it)
- Anonymous wiki culture

**How to fix:**
- Add owner to every doc
- Add last updated date
- Add contact info or link to team

**Prevention:**
- Owner required for every doc
- Template includes owner field
- Regular ownership audits

---

## 12. Condescending Docs

**Symptom:** Documentation talks down to the reader.

**What it looks like:**
- "Obviously...", "Clearly...", "Simply..."
- "This is easy"
- "Any developer should know..."
- Makes readers feel stupid

**Why it happens:**
- Author's curse of knowledge
- Trying to make it sound easy
- Unintentional elitism

**How to fix:**
- Remove condescending words
- State prerequisites explicitly
- Assume reader is capable but unfamiliar
- Test with beginners

**Prevention:**
- Ban list: obviously, clearly, simply, just, easy
- Empathy check before publishing

*See: [Writing Style](03-writing.md)*

---

## 13. Wall of Text

**Symptom:** Dense paragraphs with no visual hierarchy.

**What it looks like:**
- Long paragraphs (10+ sentences)
- No bullets or lists
- Few or no headers
- No whitespace
- Readers' eyes glaze over

**Why it happens:**
- Stream-of-consciousness writing
- No editing
- Not understanding how people scan

**How to fix:**
- Break into short paragraphs (3-5 sentences)
- Add headers
- Convert paragraphs to lists
- Add whitespace

**Prevention:**
- The squint test
- Edit ruthlessly
- Visual hierarchy from the start

*See: [Visual Design](04-visual-design.md)*

---

## 14. Link Rot

**Symptom:** Links point to moved or deleted pages.

**What it looks like:**
- 404 errors everywhere
- "This page has moved"
- Links to old wiki that no longer exists
- Internal links broken

**Why it happens:**
- Pages moved without updating links
- No link checking
- External links disappear over time

**How to fix:**
- Run link checker
- Update or remove broken links
- Use relative links internally
- Archive pages rather than delete

**Prevention:**
- Automated link checking (CI)
- Regular link audits
- Link checking before publish

*See: [Maintenance](05-maintenance.md)*

---

## 15. The Tutorial That's Actually Reference

**Symptom:** Document claims to teach but just lists features.

**What it looks like:**
- Title: "Getting Started with API"
- Content: List of all API endpoints with parameters
- No examples
- No guided flow

**Why it happens:**
- Confused about document types
- Reference docs are easier to write
- No clear structure

**How to fix:**
- Separate tutorial and reference
- Tutorial: guided journey with examples
- Reference: comprehensive listing
- Label clearly

**Prevention:**
- Understand the four doc types
- Template for each type
- Clear naming conventions

*See: [Structure - The Four Document Types](02-structure.md)*

---

## Pattern Recognition

**How to spot these in the wild:**

1. **Reader signals:**
   - "Is this still current?"
   - "Where's the actual documentation?"
   - "This doesn't work"
   - "I asked [person] instead"

2. **Metrics:**
   - Time since last update
   - Broken link count
   - Reader questions
   - Bounce rate

3. **Internal signals:**
   - Nobody references the docs
   - Onboarding takes forever
   - Same questions repeatedly
   - "I'll just figure it out from the code"

**If you recognize the pattern, you can fix it.**

---

**Next**: [Pre-Publish Checklist →](07-checklist.md)
