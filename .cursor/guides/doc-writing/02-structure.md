# Structure and Information Architecture

> "Confusion and clutter are failures of design, not attributes of information."
> — Edward Tufte

## The Problem

Bad structure makes good content invisible. A wall of text containing the perfect answer is useless if the reader can't find it. Structure is not decoration — it is the primary tool for transferring information from the page to the brain.

---

## The Inverted Pyramid

The most important information comes first. Detail flows downward. This is journalism's foundational pattern, and it works for all documentation.

```
┌─────────────────────┐
│   CONCLUSION        │  ← Most important (everyone reads)
│   What & Why        │
├─────────────────────┤
│   KEY DETAILS       │  ← Relevant specifics (most read)
│   How, When, Where  │
├─────────────────────┤
│   SUPPORTING DETAIL │  ← Context, edge cases (some read)
│   Background, Trade-offs
├─────────────────────┤
│   DEEP DIVE         │  ← Full explanation (few read)
│   References, Appendices
└─────────────────────┘
```

**Why this works:**
- Readers can stop at any point and still get value
- The first paragraph answers "Should I keep reading?"
- Busy readers get what they need without scrolling
- Patient readers can go as deep as they want

**Anti-pattern:** Starting with history, background, or "let me explain the problem first."

*Source: Inverted pyramid from journalism (1860s+). Roy Peter Clark's "Writing Tools" (2006). Barbara Minto's "Pyramid Principle" (1987).*

---

## One Document, One Purpose

Every document must serve exactly one function. If you're trying to combine tutorial + reference + troubleshooting in one document, you're creating three documents pretending to be one — and failing at all three.

### The Four Document Types

Documentation exists in four distinct forms. Each needs different structure:

#### 1. Tutorial (Learning-Oriented)

**Purpose:** Take the reader from zero to capable through a guided journey.

**Structure:**
```
Title: What you'll build/learn
├── Introduction: What you'll learn and why it matters
├── Prerequisites: What you need before starting
├── Step 1: First concrete action
├── Step 2: Next action (builds on step 1)
├── Step 3: Continue...
├── What You Built: Recap the accomplishment
└── Next Steps: Where to go from here
```

**Characteristics:**
- Sequential
- Example-driven
- Explains *why* as you go
- Holds the reader's hand
- Assumes low expertise

**Example:** "Building Your First API Endpoint"

#### 2. How-To Guide (Task-Oriented)

**Purpose:** Help the reader accomplish a specific task. They know *what* they want to do, they need to know *how*.

**Structure:**
```
Title: How to [accomplish goal]
├── Summary: What this achieves (1-2 sentences)
├── Prerequisites: What must be true before starting
├── Steps:
│   1. Do this (concrete action)
│   2. Do that (concrete action)
│   3. Verify (expected outcome)
└── Troubleshooting: Common issues
```

**Characteristics:**
- Goal-focused
- Minimal explanation
- Clear steps
- Expected outcomes at each step
- Assumes intermediate expertise

**Example:** "How to Add a New Database Migration"

#### 3. Reference (Information-Oriented)

**Purpose:** Provide authoritative, complete information for lookup. The reader knows what they're looking for.

**Structure:**
```
Title: [Component/API/Config] Reference
├── Summary: What this is (1 sentence)
├── Quick Reference Table/List
├── Detailed Entries (alphabetical or logical grouping):
│   ├── Entry 1: Name, signature, parameters, return value, example
│   ├── Entry 2: (same structure)
│   └── Entry N: (same structure)
└── Related: Links to tutorials and guides
```

**Characteristics:**
- Comprehensive
- Consistent format per entry
- Scannable (tables, lists)
- Minimal prose
- Assumes reader knows what they're looking for

**Example:** "API Endpoint Reference", "Configuration Options"

#### 4. Explanation (Understanding-Oriented)

**Purpose:** Clarify concepts, provide context, explain trade-offs. The reader wants to *understand*, not necessarily *do*.

**Structure:**
```
Title: Understanding [concept]
├── Summary: What this is and why it matters
├── The Problem: What challenge this addresses
├── How It Works: The mental model
├── Trade-offs: When to use, when not to use
├── Examples: Concrete scenarios
└── Further Reading: Links to reference and how-tos
```

**Characteristics:**
- Conceptual
- Provides mental models
- Explores trade-offs
- Not sequential
- Assumes reader is curious, not urgent

**Example:** "Understanding Event-Driven Architecture"

**The key insight:** Don't mix these. A tutorial with a reference table dumped in the middle confuses. A how-to guide that stops to explain concepts loses the reader.

*Source: Diátaxis framework by Daniele Procida (2017). "Living Documentation" by Cyrille Martraire (2019).*

---

## Document Anatomy

### Minimal Viable Structure

Every document needs these three elements:

```markdown
# Title: What This Is (5-10 words)

**Summary:** What you need to know (2-5 sentences)

[Body: The actual content]
```

If you have nothing else, you have this.

### Complete Structure

For longer documents:

```markdown
# Title

**Last updated:** YYYY-MM-DD | **Owner:** Name

**Summary:** What this is and why it matters (2-5 sentences)

**Prerequisites:** What you need to know or have before reading

---

## Section 1: First Major Topic

Content...

## Section 2: Second Major Topic

Content...

---

## Next Steps

- [Related Document 1](link)
- [Related Document 2](link)

## Further Reading

- [Deep Dive: Topic](link)
```

**Key elements:**
- Date and owner at the top (trust signal)
- Summary before body (inverted pyramid)
- Prerequisites explicit (audience awareness)
- Next steps at the end (clear path forward)

---

## Headers as Standalone Summary

Your headers should work as a complete outline. Someone reading only the headers should understand:
- What the document covers
- The major topics
- The logical flow

### Good Headers

- Specific: "Deploying to Production" not "Deployment"
- Actionable: "How to Roll Back a Release" not "Rollback"
- Parallel structure: "Adding a Route", "Adding a Middleware", "Adding a Controller"

### Bad Headers

- Generic: "Overview", "Details", "More Information"
- Vague: "Things to Know", "Important"
- Inconsistent: "Add a Route", "Middleware Information", "About Controllers"

**Test:** Read only your headers. Do they tell a story? If not, rewrite them.

---

## Progressive Disclosure

Don't dump all information at once. Layer it:

### The Four Layers

**Layer 0 — Title**
- What is this?
- 5-10 words

**Layer 1 — Summary**
- What do I need to know?
- 2-5 sentences
- Should answer: What, Why, Who

**Layer 2 — Key Details**
- Headers + bullets + tables
- Scannable
- Covers 80% of use cases

**Layer 3 — Deep Dive**
- Linked sub-documents
- Appendices
- Edge cases
- Full explanations

**Most readers need Layer 0-1. Some need Layer 2. Few need Layer 3.**

### Implementation Techniques

**Links to sub-documents:**
```markdown
## Authentication

Our system uses OAuth 2.0 for authentication.

For setup instructions, see [OAuth Setup Guide](oauth-setup.md).
For troubleshooting, see [Authentication Troubleshooting](auth-troubleshooting.md).
```

**Collapsible sections (if platform supports):**
```markdown
## Advanced Configuration

<details>
<summary>Click to expand advanced options</summary>

[Detailed configuration options here]

</details>
```

**Summary tables with links:**
```markdown
| Topic | Quick Answer | Details |
|-------|--------------|---------|
| Setup | `npm install && npm start` | [Full Setup Guide](setup.md) |
| Deploy | Merge to main | [Deployment Guide](deploy.md) |
```

---

## Navigation Patterns

### Parent-Child Hierarchy

```
README.md (overview, links to all major sections)
├── docs/
│   ├── getting-started.md (beginner path)
│   ├── tutorials/
│   │   ├── tutorial-1.md
│   │   └── tutorial-2.md
│   ├── how-to/
│   │   ├── how-to-deploy.md
│   │   └── how-to-rollback.md
│   ├── reference/
│   │   ├── api-reference.md
│   │   └── config-reference.md
│   └── architecture/
│       ├── system-overview.md
│       └── decision-records/
```

**Rules:**
- Parent documents link to children
- Children link back to parent
- Siblings link to each other where relevant
- Keep hierarchy shallow (max 3-4 levels)

### Index Pages

Every directory with multiple documents needs an index:

```markdown
# Topic Index

- **[Getting Started](getting-started.md)** — Begin here if you're new
- **[How-To Guides](how-to/)** — Task-oriented guides
- **[Reference](reference/)** — Complete API and config documentation
- **[Architecture](architecture/)** — System design and decisions
```

### Breadcrumb Links

At the top of deep documents:

```markdown
[Home](../../README.md) > [Docs](../index.md) > [How-To](index.md) > Deploy to Production
```

---

## Cross-Linking Strategy

### When to Link

**Do link:**
- To prerequisites (concepts reader must know first)
- To related tasks (next steps, alternatives)
- To detailed explanations (Layer 3 content)
- To reference documentation (API specs, config options)

**Don't link:**
- To external sites mid-paragraph (breaks flow)
- Gratuitously ("for more on HTTP, see HTTP spec")
- To documents you don't control (they'll break)
- Multiple times to the same target in one document

### How to Link

**Inline with context:**
```markdown
Authentication uses OAuth 2.0. See the [OAuth Setup Guide](oauth-setup.md) for configuration.
```

**List of related docs:**
```markdown
## Related Topics

- [Authentication](auth.md) — How auth works
- [Authorization](authz.md) — Permission model
- [Sessions](sessions.md) — Session management
```

**Next steps section:**
```markdown
## Next Steps

1. [Configure Authentication](configure-auth.md)
2. [Set Up User Roles](user-roles.md)
3. [Deploy to Production](deploy.md)
```

---

## The Squint Test

Print or zoom out on your document. Squint. You should see:
- Clear visual hierarchy (headers stand out)
- Whitespace between sections
- Short paragraphs
- Bullets and lists, not walls of text
- Tables where appropriate

If you see a wall of gray text — restructure.

*Source: Garr Reynolds' "Presentation Zen" (2008). "The Non-Designer's Design Book" by Robin Williams (2004).*

---

## Checklist

Before publishing:
- [ ] Document has exactly one purpose
- [ ] Title clearly states what this is
- [ ] Summary (2-5 sentences) at the top
- [ ] Inverted pyramid: most important info first
- [ ] Headers work as a standalone outline
- [ ] Progressive disclosure: summary → details → deep dive
- [ ] Cross-links to related docs
- [ ] Date and owner visible
- [ ] Next steps or related docs at the end
- [ ] Passes the squint test (clear hierarchy, not a wall of text)

---

**Next**: [Writing Style and Language →](03-writing.md)
