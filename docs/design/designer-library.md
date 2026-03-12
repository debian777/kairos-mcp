# KAIROS UI/UX Designer Library

> **Extended reference.** The kairos-ui-designer skill (`.cursor/skills/kairos-ui-designer/SKILL.md`) is self-sufficient for design and mockups. This file provides the full UX guidelines, KAIROS product context, and tokens for deeper detail or implementation. See [docs/design/README.md](README.md) for the design-docs structure.

---

# Part 1: UX Guidelines

Synthesised from Material Design 3, Apple HIG, WCAG 2.2, and GenAI-UI-UX-Markdowns. These are the rules. Follow them.

---

## 00 — Core Principles

Design flows around user goals. Every element must earn its place; consistency and feedback are non-negotiable.

### The Six Principles

1. **User-centred.** Design around user goals, not system structure. Identify who uses the product, what they accomplish, and in what context. Prioritise their tasks in layout, copy, and interaction order.

2. **Simplicity.** Remove non-essential elements; reduce cognitive load. Minimalist aesthetic with ample whitespace. Avoid visual flourishes that don't support the core purpose.

3. **Consistency.** Reuse patterns, naming, and layouts across screens. Use documentation as the source of truth. Ensure consistency of style conventions and terminology.

4. **Feedback.** Every user action has a clear, timely response. Buttons, inputs, and navigation provide instant visual feedback. Loading and progress communicated; errors explained and recoverable.

5. **Error tolerance.** Prevent errors where possible (constraints, defaults, confirmations for destructive actions). When errors occur, provide clear recovery paths: inline validation, specific error messages, one-step correction.

6. **Accessibility.** WCAG POUR: perceivable, operable, understandable, robust. Keyboard accessibility, visible focus, sufficient contrast, semantic structure. WCAG 2.2 Level AA minimum.

### Aesthetic and brand

- Adapt styling to brand (logo colours). If no brand given, suggest a coherent, accessible colour combination.
- Choose a personality (professional, friendly, technical) and apply consistently in copy and visual tone.
- KAIROS personality: **professional, precise, trustworthy.** Technical audience; clean, no-nonsense.

### What to avoid

| Avoid | Prefer |
|-------|--------|
| Designing for system structure | Designing for user tasks and goals |
| Dense, decorative UI | Minimal, purposeful elements and whitespace |
| Inconsistent patterns per screen | Reused components and naming |
| Silent or delayed feedback | Immediate, clear feedback |
| Errors with no recovery path | Inline messages and clear next steps |
| Colour or motion as sole indicator | Redundancy (colour + shape, text + icon) |

---

## 01 — Layout and Visual Hierarchy

### Hierarchy

- Establish via size, weight, colour, spacing. More important = larger, bolder, more whitespace.
- Group related elements using proximity and alignment.
- Generous whitespace. Macro separates major blocks; micro separates lines.
- Navigation and primary actions in predictable locations.

### Spacing and grid

- Base unit scale: 8px. Multiples: 8, 16, 24, 32, 48.
- 12-column flexible grid for web.
- Line measure: 40–75 characters for body text.
- CSS variables for spacing: `--space-1: 0.25rem`, `--space-2: 0.5rem`, etc.
- Semantic HTML5 sectioning: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `<section>`. ARIA landmarks.

### Responsive

- Flexible grids and relative sizing. Breakpoints at 768px, 1024px.
- Mobile-first when appropriate. No crucial content cropped on small screens.
- Media queries: `@media (min-width: 768px)`. Prefer relative units (%, rem, vw/vh).

### Margins and pacing

- Consistent margins frame content. Headings closer to following text than preceding.
- Whitespace creates "areas of rest" and controls consumption pace.

---

## 02 — Typography

### Font selection and scale

- One or two families; prefer sans-serif for UI.
- Semantic naming: heading, body, caption, label.
- Relative units (rem). Base font size 16px at root. Text resizable to 200%.

### Hierarchy and readability

- Size, weight, line spacing establish hierarchy.
- Line-height: 1.4–1.6 for body. Tighter for headings.
- Line length: 40–75 characters. Use max-width or grid.
- Sufficient contrast (see Color and Accessibility sections).

### Letter spacing and alignment

- Letter-spacing on uppercase text: `0.1em`.
- Left-align body text. Centre/right for specific patterns only.

### Emphasis and links

- Bold/italic/colour sparingly. Semantic tags: `<strong>`, `<em>`.
- Underline only for links.
- Limit font weights: regular (400), medium (500), semibold (600), bold (700).

---

## 03 — Color and Theming

### Colour roles

- **Primary**: Key actions, CTAs, brand.
- **Secondary**: Supporting actions.
- **Accent**: Emphasis, highlights.
- **Semantic**: Red = error/destructive, green = success, amber = warning. Never colour alone; pair with icon or text.
- **Calls to action**: Primary or high-contrast so CTAs are identifiable.

### WCAG contrast

| Context | AA | AAA (aim where possible) |
|---------|----|--------------------------|
| Normal text | 4.5:1 | 7:1 |
| Large text (18pt+ or 14pt+ bold) | 3:1 | 4.5:1 |
| UI components and graphics | 3:1 | — |

### Don't rely on colour alone

Never use colour as the only cue for meaning (error, required, selected). Combine with borders, icons, text.

### Implementation

- CSS variables: `--color-primary`, `--color-text`, `--color-error`, etc.
- Contrast checkers during development.

---

## 04 — Components and States

### State matrix

Every interactive component must define all six states:

| State | Purpose | Notes |
|-------|---------|-------|
| Default | Rest state, clear affordance | Matches type (primary, secondary) |
| Hover | Cursor over | Darker bg, border, shadow; transition 0.2s |
| Focus | Keyboard focus | Visible outline/ring; ≥ 3:1 contrast; must not be removed |
| Active | During press | Darker; optional translateY(1px) |
| Disabled | Not interactive | Muted; cursor: not-allowed; excluded from tab order |
| Error | Invalid/destructive | Red border + message; not colour alone |

### Buttons

- Primary: solid high-contrast. Secondary: outline.
- Hover: bg darkens ~10%. Focus: 2px outline, offset 2px. Active: ~15% darker. Disabled: reduced opacity, muted.

### Touch targets

- Minimum 44×44px (WCAG 2.2 Target Size 2.5.8).
- Consistent padding, icon size, label placement.

### Focus visibility

- All interactive elements: keyboard reachable, visible focus indicator.
- `*:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }` with ≥ 3:1 contrast.

---

## 05 — Interaction, Motion and Feedback

### Principles

- Motion clarifies relationships and transitions; does not decorate.
- Short, purposeful animations with natural easing.
- Instant visual feedback on every action.
- Respect `prefers-reduced-motion: reduce`. Disable or shorten animations.

### Feedback rules

| Situation | Rule |
|-----------|------|
| Button press | Immediate visual change (active state or loading) |
| Form submit | Loading state; then success or inline error |
| Navigation | Quick transition; no long blocking animations |
| Error | Inline message; not colour/motion alone |

---

## 06 — Forms and Data Input

### Labels

- **Always visible labels.** `<label>` or `aria-label`. Never placeholder as only label.
- Associate label and input: `<label for="id">` with `id` on input.
- Position labels consistently (above input; less space below label than above).

### Form states

| State | Appearance |
|-------|-----------|
| Normal | Border, bg, text defined. Label visible. |
| Placeholder | Lighter hint text; not only identification. |
| Hover | Subtle border change. |
| Focus | Prominent outline/shadow. |
| Error | Error-colour border + message near field + icon/text (not colour alone). |
| Disabled | Muted bg and text; cursor: not-allowed. |

### Validation

- Inline on blur or submit. Messages next to field.
- Actionable: "Enter a valid email" not "Invalid input".
- For long forms: error summary at top with links to fields.

### Tab order

- Logical: matches visual layout and task flow.
- Group related fields with `<fieldset>` + `<legend>`.
- Show constraints up front (format, length, required).

### Code

- Semantic: `<form>`, `<label>`, `<input>`, `<textarea>`, `<fieldset>`, `<legend>`.
- Errors: `aria-invalid="true"`, `aria-describedby` pointing to error element.

---

## 07 — Navigation and Information Architecture

### Primary navigation

- Shallow: 5–7 top-level items max. Nest only for clear sub-sections.
- Descriptive labels: task/topic names, not jargon.
- Predictable location: top bar (or side rail). Don't move between screens.

### Current location

- Active state on current nav item (underline, bg, bold).
- `aria-current="page"` on current link.
- Page heading reinforces location.

### Breadcrumbs

- For deep hierarchies. Visible, keyboard navigable.
- Clear separator (/, >, chevron). Last item = current page.

### Search

- When content volume is high: search in header or nav.
- Results: clear, scannable, keyboard accessible.

### Skip links

- "Skip to main content" at page start. Visible on focus.

---

## 08 — Accessibility

### WCAG 2.2 POUR checklist (AA)

**Perceivable:**
- 1.1.1: Text alternative for non-text content.
- 1.3.1: Structure programmatically determinable (semantic HTML, ARIA).
- 1.3.2: Meaningful reading sequence.
- 1.4.1: Colour not the only cue.
- 1.4.3: Contrast ≥ 4.5:1 (normal) / 3:1 (large).
- 1.4.4: Text resizable to 200%.
- 1.4.11: UI components ≥ 3:1 against adjacent colours.
- 1.4.13: Dismissible/hoverable for content on hover/focus.

**Operable:**
- 2.1.1: All functionality via keyboard.
- 2.1.2: No keyboard trap.
- 2.4.7: Focus visible.
- 2.4.11: Focus not obscured.
- 2.5.8: Target size minimum.

**Understandable:**
- 3.1.1: Language of page (`lang` on `<html>`).
- 3.2.1: No context change on focus.
- 3.2.2: No context change on input without warning.
- 3.3.1: Errors identified in text.
- 3.3.2: Labels/instructions for inputs.

**Robust:**
- 4.1.2: Name, role, value programmatically determinable.
- 4.1.3: Status messages programmatically determined (`role="status"`, live regions).

### Keyboard

- All interactive elements reachable via Tab, Enter, Space, arrows.
- No traps. Skip link. Focus order matches visual order.

### Focus styles

- Visible on `:focus-visible`. 2px outline, offset 2px, ≥ 3:1 contrast.
- Not obscured by overlays, sticky headers, modals.

### Semantic HTML and ARIA

- Semantic: `<header>`, `<nav>`, `<main>`, `<button>`, `<label>`.
- ARIA when HTML insufficient: `aria-label`, `aria-describedby`, `aria-invalid`, `aria-current`, `role="alert"`, live regions.
- Headings `<h1>`–`<h6>` for structure; not for visual effect.
- `<html lang="en">`.

---

## 09 — Design Systems and Documentation

### Tokens

- Centralise tokens: colour, spacing, typography, motion, elevation.
- Semantic names: `--color-primary`, `--space-2`, `--font-size-body`.
- CSS variables as single source of truth.

### Components

- Define once with all states. Reuse everywhere.
- Document: name, purpose, variants, states, props, code snippets, do/don't.

### Documentation

- Single source of truth. Changelog for design system changes.
- Usage guidelines for each token and component.

---

## 10 — AI Agent Usage (design-lint)

### Design-lint prompt template

```
Given this [component/mockup] and the UI/UX guidelines:
1. List all violations (contrast, focus, states, labels, semantics, touch targets, colour-only indicators).
2. For each violation, suggest a concrete change.
```

### When to include which files

| Task | Include |
|------|---------|
| Global rules | 00-principles, 08-accessibility |
| Layout | 01-layout |
| Typography | 02-typography |
| Colour/contrast | 03-color, 08-accessibility |
| Buttons, inputs, cards | 04-components, 06-forms |
| Motion/feedback | 05-interaction |
| Nav/IA | 07-navigation |
| Tokens/design system | 09-design-systems |

---

# Part 2: KAIROS Product Context

Everything the designer needs to know about the product to design the right UI.

---

## What KAIROS is

KAIROS MCP is a Model Context Protocol server for persistent memory and deterministic protocol-chain execution. It stores workflows as linked memory chains where each step carries a proof-of-work challenge.

**Primary users:**
- **Protocol authors**: Create, edit, and manage protocols (workflows).
- **End users**: Browse, discover, and view protocols. Execution happens via AI agents (MCP) or CLI.

**The UI is for humans.** The MCP/API is for agents. Different audiences, different UX.

---

## Search API — what the protocol browser shows

`POST /api/kairos_search` returns a `choices` array. Each choice has:

- `uri` — protocol URI (e.g. `kairos://mem/<uuid>`)
- `label` — protocol or step title
- `chain_label` — chain (protocol) title (may differ from label)
- `score` — 0.0–1.0 confidence (null for non-match entries)
- `role` — `match` | `refine` | `create`
- `tags` — keyword array
- `next_action` — what to do with this choice (agent instruction; UI translates to View/Refine/Create)

**Roles:**
- `match` — search result with numeric score. UI: **View** button.
- `refine` — system action to improve the search query. UI: **Refine search**.
- `create` — system action to create a new protocol. UI: **Create new**.

**Ordering:** Matches first (sorted by score), then refine, then create.

**Scenarios:**
- Single match: one choice, View.
- Multiple matches: list with View per match, Refine and Create at end.
- Weak matches: same as multiple, but scores are modest.
- No matches: only Refine and Create.

---

## Protocol structure — what the detail page shows

A protocol is a markdown document with:

- **H1**: Protocol chain title (one H1 = one chain).
- **H2**: Step labels. Each step may have a trailing JSON block with `{"challenge": {...}}`.
- **Natural language triggers** section: keywords/phrases that match this protocol in search.
- **Completion rule** section: when the protocol is considered done.

### Challenge types (for display, not execution)

The UI shows challenge types in protocol detail (read-only, not executed):

| Type | What it means | Display |
|------|--------------|---------|
| `shell` | Run a command | Show command text |
| `mcp` | Call an MCP tool | Show tool name |
| `user_input` | Get human confirmation | Show prompt text |
| `comment` | Write a text summary | Show min length requirement |

### Solution shapes (reference only — UI does not execute)

| Type | Solution | Pass condition |
|------|----------|----------------|
| shell | `{ exit_code, stdout, stderr }` | exit_code === 0 |
| mcp | `{ tool_name, result, success }` | success === true |
| user_input | `{ confirmation }` | Agent supplies real user reply |
| comment | `{ text }` | text.length ≥ min_length |

---

## Error recovery UX

**Design principle:** Errors teach; recovery is in the error.

When APIs return errors, they include:
- `message` — what went wrong (human-readable).
- `next_action` — what to do next (agent-readable; UI can display or translate).
- `error_code` — structured code (e.g. `MISSING_PROOF`, `MISSING_FIELD`).

The UI should:
- Show `message` prominently in an error alert.
- Show `next_action` as secondary text (or translate to a user-friendly action).
- Provide retry, go back, or other recovery depending on context.

---

## Auth and infrastructure

### Keycloak

- Keycloak handles all authentication. Login page, provider selection (local, Google, Apple, Okta, Azure AD) — all Keycloak.
- The KAIROS UI only handles post-login redirect (session cookie) and displays the authenticated user.
- No login form in the KAIROS UI. No Keycloak management in the KAIROS UI.
- Keycloak theme is out of scope.

### Infrastructure

- Express serves API + UI static files. Same process.
- UI base path: `/ui`. Root `/` redirects to `/ui`.
- Local dev: `http://localhost:3300/`
- Default ports: App 3000 (Docker) or 3300 (fullstack), Keycloak 8080, Qdrant 6333, Redis 6379.

### Security

- HTTPS for all external endpoints in production.
- Strong `SESSION_SECRET` when auth enabled.
- No secrets in repo. `.env*` files not committed.
- Restrict network access to Qdrant and Redis.

---

## Agent-facing design principles (from CONTRIBUTING.md)

These apply to MCP tools, not the human UI. But they inform how the backend works and what data the UI receives:

1. **MCP users are AI agents.** The API is designed for agents. The UI translates API data for humans.
2. **Consistent names.** Same concept = same name everywhere.
3. **Errors teach.** Error messages guide correction and retry. The UI should surface this guidance.
4. **`next_action` in every response.** The UI translates `next_action` from agent instructions to human actions (View, Edit, Retry).
5. **`must_obey` semantics.** `true` = follow instruction; `false` = choose. The UI doesn't need to implement this; it's agent-facing.

---

## Design system tokens

### Color

| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | `#0d9488` (teal) | Key actions, CTAs, brand |
| `--color-primary-hover` | `#0f766e` | Primary hover |
| `--color-secondary` | `#64748b` | Supporting actions |
| `--color-accent` | `#0ea5e9` | Emphasis |
| `--color-text` | `#1e293b` | Body copy |
| `--color-text-heading` | `#0f172a` | Headings |
| `--color-text-muted` | `#64748b` | Secondary text |
| `--color-surface` | `#ffffff` | Page background |
| `--color-surface-elevated` | `#f8fafc` | Cards, dropdowns |
| `--color-border` | `#e2e8f0` | Borders, dividers |
| `--color-error` | `#dc2626` | Error text |
| `--color-error-bg` | `#fef2f2` | Error background |
| `--color-success` | `#16a34a` | Success |
| `--color-warning` | `#d97706` | Warning |
| `--color-focus-ring` | `var(--color-primary)` | Focus outline |

### Spacing (base 8px)

| Token | Value |
|-------|-------|
| `--space-1` | 0.25rem (4px) |
| `--space-2` | 0.5rem (8px) |
| `--space-3` | 0.75rem (12px) |
| `--space-4` | 1rem (16px) |
| `--space-6` | 1.5rem (24px) |
| `--space-8` | 2rem (32px) |
| `--space-12` | 3rem (48px) |

### Typography

| Token | Size | Line-height | Use |
|-------|------|-------------|-----|
| `--font-size-xs` | 0.75rem | 1.25 | Caption, label |
| `--font-size-sm` | 0.875rem | 1.4 | Small body |
| `--font-size-base` | 1rem | 1.6 | Body |
| `--font-size-lg` | 1.125rem | 1.5 | Lead |
| `--font-size-xl` | 1.25rem | 1.4 | H3 |
| `--font-size-2xl` | 1.5rem | 1.3 | H2 |
| `--font-size-3xl` | 2rem | 1.2 | H1 |

Font: system-ui, sans-serif. Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold).

### Component tokens

- Touch targets: min 44×44px.
- Focus: 2px outline, offset 2px, `var(--color-focus-ring)`.
- Border radius: `--radius-sm: 0.25rem`, `--radius-md: 0.375rem`, `--radius-lg: 0.5rem`.
- Motion: 150–250ms for UI transitions. Respect `prefers-reduced-motion`.

---

## Tech stack (for reference — not for this design plan)

Target stack for implementation (separate build plan):

- React 19 + TypeScript + Vite
- Tailwind CSS + CSS custom properties
- shadcn/ui (Radix primitives + Tailwind)
- React Router v7, TanStack Query, react-i18next, Zod

Rationale: [docs/architecture/ui-frontend-stack-decision.md](../architecture/ui-frontend-stack-decision.md)

---

## Themes and languages

- Architecture supports themes (CSS custom properties) and i18n (react-i18next, JSON translation files) from day one.
- v1: one default theme, English only.
- Adding a theme = adding a CSS variable set. Adding a language = adding a JSON file.
