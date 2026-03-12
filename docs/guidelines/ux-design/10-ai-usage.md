# AI Agent Usage

> Use this guide in system prompts, RAG, or design-lint flows so AI-generated or -reviewed UI follows the same rules without depending on external URLs.

---

## 1. System / Instruction Prompt

Paste a **condensed version** of the guidelines (sections 00–09) into the agent’s system message so it enforces global design rules when generating or editing UI.

**What to include:**

- Core principles: user-centred, simplicity, consistency, feedback, error tolerance, accessibility.
- One-line rules for: layout (grid, spacing), typography (scale, contrast), colour (roles, WCAG contrast), components (states, focus, touch targets), motion (purposeful, reduce-motion), forms (labels, validation), navigation (current location, breadcrumbs), accessibility (WCAG 2.2 AA, keyboard, focus, semantic HTML).

**Example instruction snippet:**

```
When generating or editing UI (HTML/CSS/JSX, Figma, or specs):
- Follow the UI/UX guidelines in [guides/ux-design/]. Prefer local guide files over external links.
- Ensure: visible focus, WCAG 2.2 AA contrast, semantic HTML, labels for all inputs, no placeholder-only labels.
- Use design tokens (e.g. CSS variables) for color and spacing when the project defines them.
- For each interactive component, consider default, hover, focus, active, disabled, and error states.
```

Adjust paths and depth to the agent’s context (e.g. “follow guides/ux-design/00-principles.md and 08-accessibility.md” for a narrow task).

---

## 2. RAG / Knowledge Base

- **Index** this guide (and per-topic files) in your vector store so the agent can retrieve relevant passages when generating or reviewing UI.
- **Tool**: Expose a “UI/UX Guidelines” (or “Design rules”) tool that the agent calls with a query (e.g. “button states”, “form validation”, “contrast”) and returns chunks from the guide. Prefer returning local file content over external URLs.
- **File selection**: For RAG, include at least [00-principles.md](00-principles.md), [03-color.md](03-color.md), [04-components.md](04-components.md), [06-forms.md](06-forms.md), [08-accessibility.md](08-accessibility.md). Add [01-layout.md](01-layout.md), [02-typography.md](02-typography.md), [05-interaction.md](05-interaction.md), [07-navigation.md](07-navigation.md), [09-design-systems.md](09-design-systems.md) when the task involves layout, motion, navigation, or design systems.

*Adapted from GenAI-UI-UX-Markdowns: “Reference specific Markdown files or sections based on the code you need the AI to generate.”*

---

## 3. Design-Linting Tool

Feed **component specs** (JSON, JSX, Figma JSON, or HTML) plus **relevant guide sections** (e.g. Color, Components, Accessibility) to the agent and ask it to:

- **List violations** of the guidelines (e.g. missing focus style, placeholder used as only label, contrast below 4.5:1).
- **Suggest changes** to meet the rules (e.g. “Add a visible focus ring”, “Associate a <label> with the input”, “Use a token for primary colour”).

**Example lint prompt:**

```
Given this [component/snippet] and the UI/UX guidelines in [guides/ux-design/03-color.md, 04-components.md, 08-accessibility.md]:
1. List all violations of these guidelines (contrast, focus, states, labels, semantics).
2. For each violation, suggest a concrete change (code or spec).
```

Use the same guide files for consistency; avoid ad-hoc “best practices” that contradict the local docs.

---

## When to Include Which Files

| Task | Include |
|------|---------|
| Global design rules | 00-principles, 08-accessibility |
| Layout / responsive | 01-layout |
| Typography | 02-typography |
| Colour / contrast | 03-color, 08-accessibility |
| Buttons, inputs, cards | 04-components, 06-forms |
| Motion / feedback | 05-interaction |
| Nav / IA | 07-navigation |
| Tokens / design system | 09-design-systems |
| Prompt or RAG setup | This file (10-ai-usage) |

*Based on GenAI-UI-UX-Markdowns: “Identify the Component/Section… Select Relevant Files… Specify Requirements.”*

---

## Source

This guide expands [UI-UX_Design_Guidelines_Sources.md](UI-UX_Design_Guidelines_Sources.md) with inlined content from Material Design 3, Apple HIG, WCAG 2.2, and [GenAI-UI-UX-Markdowns](https://github.com/jmrecodes/GenAI-UI-UX-Markdowns). For a modular, AI-oriented brief in separate files, that repository is a useful reference; this guide keeps the same structure locally with cited, synthesised content.

---

**Back to**: [INDEX](INDEX.md)
