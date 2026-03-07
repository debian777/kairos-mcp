# UI/UX Design Guidelines for AI Agents

> A self-contained reference of UI/UX best practices for prompts, RAG corpora, and design-linting agents. Content is local; external sources are synthesised and cited.

---

## Who This Is For

AI agents that generate or review UI (code, Figma, specs), and humans who configure those agents. Use this guide to enforce consistent, accessible, user-centred design without depending on live URLs.

---

## Guide Structure

### Foundation

**[00 — Core Principles](00-principles.md)**  
User-centred design, simplicity, consistency, feedback, error tolerance, accessibility. Synthesised from Material Design 3, Apple HIG, and GenAI-UI-UX-Markdowns.

### Layout & Visuals

**[01 — Layout & Visual Hierarchy](01-layout.md)**  
Grid systems, spacing scales, whitespace, responsive breakpoints, sectioning and ARIA.

**[02 — Typography](02-typography.md)**  
Type scales, hierarchy, line length, contrast, relative units, semantic HTML.

**[03 — Color & Theming](03-color.md)**  
Color roles, M3 dynamic/static schemes, WCAG contrast levels, semantic color conventions.

### Components & Interaction

**[04 — Components & States](04-components.md)**  
State matrix (default, hover, focus, active, disabled, error), touch targets, focus visibility.

**[05 — Interaction, Motion & Feedback](05-interaction.md)**  
M3 motion schemes (expressive/standard), spring tokens, reduce-motion, instant feedback.

**[06 — Forms & Data Input](06-forms.md)**  
Labels vs placeholders, validation, error messages, tab order, Gov.UK-style patterns.

**[07 — Navigation & Information Architecture](07-navigation.md)**  
Shallow nav, breadcrumbs, current location, search, nav component states.

### Standards & Systems

**[08 — Accessibility](08-accessibility.md)**  
WCAG 2.2 AA POUR checklist, keyboard navigation, focus, ARIA, semantic structure.

**[09 — Design Systems & Documentation](09-design-systems.md)**  
Tokens, component libraries, usage docs, changelogs.

### Using This Guide with AI

**[10 — AI Agent Usage](10-ai-usage.md)**  
System prompts, RAG indexing, design-lint prompts, and file-selection guidance.

---

## How to Use This Guide

| If you need… | Use… |
|--------------|------|
| Global design rules in a system prompt | [00 — Principles](00-principles.md) + condensed bullets from 01–09 |
| Layout or typography specs | [01 — Layout](01-layout.md), [02 — Typography](02-typography.md) |
| Color and contrast rules | [03 — Color](03-color.md), [08 — Accessibility](08-accessibility.md) (contrast) |
| Component states (buttons, inputs) | [04 — Components](04-components.md), [06 — Forms](06-forms.md) |
| Motion and feedback rules | [05 — Interaction](05-interaction.md) |
| Accessibility checklist | [08 — Accessibility](08-accessibility.md) |
| Prompt templates for AI | [10 — AI Agent Usage](10-ai-usage.md) |

---

## Related Guides

- **[Documentation That Transfers Knowledge](../doc-writing/INDEX.md)** — Writing and structure for docs.
- **[Git Repository Documentation](../git-docs/INDEX.md)** — READMEs, changelogs, three-audience model.

---

## Source Document

This guide expands [UI-UX_Design_Guidelines_Sources.md](UI-UX_Design_Guidelines_Sources.md) by inlining content from Material Design 3, Apple HIG, WCAG 2.2, GenAI-UI-UX-Markdowns, and related references. The original file remains the link-only index.
