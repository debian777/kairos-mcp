# Core Principles

> Design flows around user goals. Every element must earn its place; consistency and feedback are non-negotiable.

---

## The Six Principles

### 1. User-centred

Design flows around **user goals**, not system structure or internal org charts. Identify who uses the product, what they are trying to accomplish, and in what context (calm research vs. incident response). Prioritise their tasks in layout, copy, and interaction order.

*Synthesised from Apple Human Interface Guidelines (clarity, deference to content) and Material Design foundations; GenAI-UI-UX-Markdowns: "Design for content, don't fit the content to the design."*

### 2. Simplicity

Remove non-essential elements; reduce cognitive load. Strive for a minimalist aesthetic with ample whitespace. Avoid unnecessary visual flourishes (gradient backgrounds, decorative rounded corners) that don't support the core purpose. Support meaning and make information easier to see, process, and use.

*GenAI-UI-UX-Markdowns: "Prioritize Simplicity", "Remove unnecessary elements", "Support meaning and make information easier to see, process, and use."*

### 3. Consistency

Reuse patterns, naming, and layouts across screens. Maintain visual consistency and standardised elements. Use documentation as the source of truth to avoid rogue variations. Ensure consistency of style conventions and terminology.

*Apple HIG: consistency in visual language and behaviour. GenAI-UI-UX-Markdowns: "Use documentation as a source of truth to reduce the chance of multiple rogue variations."*

### 4. Feedback

Every user action must have a **clear, timely response**. Buttons, inputs, and navigation should provide instant visual feedback on tap/click/press. Loading and progress should be communicated; errors must be explained and recoverable.

*Material Design and Apple HIG both emphasise immediate, understandable feedback.*

### 5. Error tolerance

Prevent errors where possible (constraints, defaults, confirmations for destructive actions). When errors occur, provide **clear recovery paths**: inline validation, specific error messages, and one-step correction where feasible.

*Aligned with WCAG Understandable (3.3) and standard form-design practice.*

### 6. Accessibility

Interfaces must be **perceivable, operable, understandable, and robust** (WCAG POUR). Ensure keyboard accessibility, visible focus, sufficient contrast, and semantic structure so assistive technologies can interpret the UI. Aim for WCAG 2.2 Level AA as a minimum.

*WCAG 2.2; Apple HIG Accessibility; GenAI-UI-UX-Markdowns: "WCAG Compliance… Aim for AA conformance as a baseline, striving for AAA where possible."*

---

## Aesthetic & Brand Alignment

- **Logo and colour**: Adapt styling to referenced brand (e.g. logo colours). If no brand is given, suggest a coherent, accessible colour combination.
- **Personality**: Choose an overall personality (professional, friendly, technical) and apply it consistently in copy and visual tone.
- **Brand identity**: Reflect brand values and tone through visual style and copy; use guidelines so the team applies patterns consistently.

*GenAI-UI-UX-Markdowns: "Overall Aesthetic & Brand", "Brand Alignment", "Choose a Personality."*

---

## What to Avoid

| Avoid | Prefer |
|-------|--------|
| Designing for system structure | Designing for user tasks and goals |
| Dense, decorative UI | Minimal, purposeful elements and whitespace |
| Inconsistent patterns per screen | Reused components and naming |
| Silent or delayed feedback | Immediate, clear feedback |
| Errors with no recovery path | Inline messages and clear next steps |
| Colour or motion as sole indicator | Redundancy (colour + shape, text + icon) |

---

**Next**: [Layout & Visual Hierarchy →](01-layout.md)
