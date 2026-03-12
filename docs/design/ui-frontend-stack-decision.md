# Frontend stack decision: KAIROS public UI

This document compares frontend technology options for the KAIROS public
web UI. It covers three realistic approaches, evaluates them against
project constraints, and recommends a path forward.

## Context

KAIROS MCP is a Node.js/TypeScript/Express 5 server. The UI will be
served under `/ui` from the same Express instance. There is no existing
frontend code. Key constraints:

- **User experience is the #1 priority.** Stack and tool choices are
  evaluated by end-user outcomes (accessibility, clarity, consistency,
  feedback), not by human learning curve. The design team is AI agents.
- **Figma MCP** (`get_design_context`) outputs React + Tailwind by
  default. This is the primary design-to-code pipeline.
- **Theming and i18n** must be architecturally supported from day one
  (one default theme and English only for the first release).
- **WCAG 2.2 AA** accessibility is non-negotiable (per UX guidelines
  08-accessibility.md).
- **Keycloak** handles authentication; the UI consumes session/cookie
  auth.
- **Primary users**: Protocol authors and end users.
- **AI-assisted development** (Cursor): code generation quality matters.

---

## Option 1: React + TypeScript SPA (Vite + Tailwind)

A single-page application built with React, bundled by Vite, and served
as static files from Express under `/ui`.

### How it works

```
ui/                     # Separate folder with its own package.json
  src/
    components/         # React components (from Figma MCP output)
    pages/              # Route-level components
    i18n/               # Translation files (en.json, future locales)
    theme/              # CSS variables, Tailwind config
  vite.config.ts        # Build config (base: '/ui')
  package.json          # React, Vite, Tailwind, react-i18next, etc.
```

Express serves `ui/dist/` as static files. The SPA handles client-side
routing; Express catches all `/ui/*` requests and serves `index.html`.

### Strengths

- **Figma pipeline alignment.** `get_design_context` outputs React +
  Tailwind. The code goes into the project with minimal adaptation.
  This is the single strongest argument for React.
- **Component ecosystem.** shadcn/ui (built on Radix UI) provides
  accessible, themeable, composable primitives (buttons, inputs, dialogs,
  tables, forms) that satisfy UX guidelines 04-components.md and
  08-accessibility.md out of the box.
- **Theming.** Tailwind + CSS custom properties (`--color-primary`,
  `--space-2`, etc.) = token-based theming per 09-design-systems.md.
  Adding a second theme means adding a second set of CSS variables.
- **i18n.** `react-i18next` is the industry standard. Translation files
  are JSON. Adding a language means adding a file.
- **AI code generation.** React has the largest share of AI training
  data. Cursor, Copilot, and similar tools produce the highest quality
  React code.
- **Separation.** The frontend is a standalone build artifact. Express
  serves it as static files. Backend code does not import React.
  Clean boundary.
- **Ecosystem maturity.** React Router, TanStack Query (for API calls),
  Zod (shared with backend) for validation. Large community, frequent
  updates, extensive documentation.

### Weaknesses

- **Build step.** Adds Vite, React, Tailwind, and ~15 dependencies to a
  separate `package.json`. Requires `npm run build` (or a watch mode)
  during development.
- **SPA complexity.** Client-side routing, state management, and
  hydration are concepts the team needs to understand (or the AI needs
  to generate correctly).
- **Initial bundle.** A React SPA is ~150-200 KB gzipped before app
  code. Not large by modern standards but heavier than server-rendered
  HTML.
- **SEO.** Not relevant here (the UI is behind auth), but worth noting
  that SPAs require extra work for public indexing.

### Key libraries

- **Build:** Vite
- **UI components:** shadcn/ui (Radix primitives + Tailwind)
- **Routing:** React Router v7
- **Data fetching:** TanStack Query
- **i18n:** react-i18next
- **Theming:** Tailwind CSS + CSS custom properties
- **Validation:** Zod (shared with backend)

---

## Option 2: Vue + TypeScript SPA (Vite + Tailwind)

Same SPA approach, but using Vue 3 instead of React.

### How it works

Same folder structure as Option 1, with `.vue` single-file components
instead of `.tsx`.

### Strengths

- **Simpler API.** Vue's reactivity model (refs, computed) is often
  cited as gentler for human developers (not a selection criterion here).
- **Good i18n.** `vue-i18n` is mature and well-documented.
- **Vite is native.** Vite was created by Vue's author (Evan You).
  First-class support.
- **Single-file components.** Template, script, and styles in one file.
  Clean for small components.

### Weaknesses

- **Figma pipeline mismatch.** `get_design_context` returns React +
  Tailwind. Every design-to-code step requires manual translation from
  JSX to Vue templates. This is the single strongest argument against
  Vue in this context.
- **Smaller ecosystem.** Fewer pre-built component libraries at the
  quality level of shadcn/ui. PrimeVue and Vuetify exist but are less
  composable.
- **Less AI training data.** Code generation tools produce lower-quality
  Vue code compared to React. More manual correction needed.
- **Smaller community.** Fewer Stack Overflow answers, blog posts, and
  tutorials.

### Verdict

Vue is a fine framework in general, but it creates friction with the
Figma MCP pipeline that is central to this plan. Not recommended here.

---

## Option 3: Server-rendered HTML (Express + EJS + HTMX)

Express renders HTML templates server-side. HTMX (~14 KB) handles
dynamic updates (partial page swaps) without a full JS framework.

### How it works

```
src/
  ui/
    views/              # EJS templates (search.ejs, run.ejs, etc.)
    partials/           # Shared partials (header, footer, nav)
    public/             # Static CSS, JS (HTMX, theme vars)
```

Express routes render views directly. HTMX attributes on HTML elements
trigger server requests that return HTML fragments, which HTMX swaps
into the DOM.

### Strengths

- **No build step.** Templates are part of the Express app. No separate
  `package.json`, no Vite, no bundler.
- **Simple mental model.** Server renders HTML. HTMX handles interactivity.
  No virtual DOM, no state management, no hydration.
- **Same language.** TypeScript everywhere. No context-switching between
  backend and frontend languages.
- **Tiny JS footprint.** HTMX is ~14 KB. No React, no router, no
  query library.
- **Fast initial load.** HTML is ready on the server. No JS parsing
  before content appears.

### Weaknesses

- **Figma pipeline mismatch.** `get_design_context` outputs React +
  Tailwind. Every output must be manually converted to EJS templates and
  vanilla CSS/Tailwind. This is significant friction.
- **Limited interactivity.** Multi-step forms (like the run view with
  challenge/solution cycles), real-time state updates, and complex
  conditional UI are harder with HTMX than with React.
- **Fewer component libraries.** No equivalent of shadcn/ui. You build
  every component from scratch or use basic CSS frameworks.
- **Theming.** Possible with CSS variables, but no component-level
  theme context. Less ergonomic than React's provider pattern.
- **i18n.** No standard solution. You'd likely build a lightweight
  i18n helper or use a library like `i18next` (without the React
  bindings).
- **Scalability.** As the UI grows (more screens, more interactivity),
  EJS templates become harder to maintain than component trees.
- **AI code generation.** Less training data for HTMX patterns. AI
  tools will be less helpful.

### Verdict

HTMX is excellent for simple, content-driven apps (blogs, admin panels
with CRUD). For a multi-step, stateful UI (search -> begin -> next loop
-> attest) with challenge-specific forms and error recovery flows, it
will feel limiting quickly. Not recommended here.

---

## Comparison summary

| Factor | React SPA | Vue SPA | Server HTML |
|--------|-----------|---------|-------------|
| Figma MCP output usable directly | Yes | No (manual) | No (manual) |
| Component library (accessible, themed) | shadcn/ui | PrimeVue | DIY |
| i18n | react-i18next | vue-i18n | DIY or i18next |
| Theming | Tailwind + CSS vars | Tailwind + CSS vars | CSS vars |
| AI code-gen quality | Highest | Medium | Low |
| Build complexity | Vite (simple) | Vite (simple) | None |
| Bundle size | ~150-200 KB gz | ~100-150 KB gz | ~14 KB (HTMX) |
| Complex interaction support | Excellent | Excellent | Limited |
| Out-of-box UX quality (a11y, components) | High (shadcn/ui) | Medium | Low (DIY) |
| Long-term maintainability | High | High | Medium |

---

## Recommendation

**React + TypeScript + Vite + Tailwind + shadcn/ui.**

The primary driver is **user experience**. shadcn/ui (Radix primitives +
Tailwind) delivers accessible, consistent, themeable components that
meet WCAG 2.2 AA and the project UX guidelines out of the box. No other
option in the table offers that UX quality without building everything
from scratch.

The design-to-code pipeline (Figma MCP → React + Tailwind) and AI code
generation quality reinforce the same choice. Learning curve is not a
criterion — the design team is AI.

The tradeoff is a build step and ~15 frontend dependencies. For a
production-facing public UI, this is a small cost compared to the
friction of fighting the design toolchain on every screen.

---

## Proposed repo layout

```
kairos-mcp-ui/
  src/                  # Existing backend source
  ui/                   # New: frontend app
    src/
      components/       # shadcn/ui + custom components
      pages/            # Route-level views
      hooks/            # Custom React hooks (API calls, auth)
      i18n/
        en.json         # English translations
      theme/
        tokens.css      # CSS custom properties
        tailwind.config.ts
      lib/              # Utilities, API client
    index.html          # SPA entry point
    vite.config.ts
    package.json
    tsconfig.json
  docs/
  tests/
  package.json          # Existing backend package.json
```

Express serves `ui/dist/` as static files under `/ui`. A catch-all
route (`/ui/*`) returns `index.html` for client-side routing.

---

## Decision

**Confirmed: React + TypeScript + Vite + Tailwind + shadcn/ui.**

User experience is the top priority; the stack is chosen for
out-of-box UX quality (accessible components, theming, i18n), not for
human learning curve. All dependencies are MIT licensed. The AI agent
acts as the design team; code-first workflow with browser canvas
mockups for review replaces the Figma-first design loop.
