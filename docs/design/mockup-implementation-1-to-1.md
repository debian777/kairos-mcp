# Mockup–implementation 1:1 (WYSIWYG)

**Problem (resolved):** HTML mockups had been updated (sidebar, KAIROS tab, Home copy, stats, Account intro, etc.) but an earlier implementation used an older design (header nav, two items, no KAIROS page). That caused drift. We removed the legacy HTML mockups and use Storybook as the single source of truth.

**Goal:** One source of truth so that what you design is what ships. No separate “mockup” vs “implementation” that can get out of sync.

---

## Options for 1:1

### 1. React as single source + Storybook as “mockups” (recommended)

- **Source of truth:** React components in `src/ui/` (Layout, pages, shared components).
- **“Mockups”:** Storybook stories that compose the same components with the same tokens. Each screen is a story (e.g. Home, KAIROS, Account, Protocol detail).
- **Flow:** Design and change screens in code or by editing stories; the app and Storybook both render the same components → 1:1 by construction.
- **Static export:** Build Storybook and copy to `docs/design/mockups/static/` via `npm run storybook:export-mockups` for shareable static mockups.
- **Pros:** No duplicate layout/copy; one design system (tokens.css); works with existing stack (React, Vite, Tailwind).  
- **Cons:** “Mockups” are code (Storybook), not a drag-and-drop WYSIWYG canvas.

**Implemented in this repo:**

1. **Storybook** (Vite + React): `.storybook/main.ts` and `preview.tsx`; stories in `src/ui/**/*.stories.tsx`. Run `npm run storybook` (port 6006).
2. **One story per screen:** `Screens.stories.tsx` — Home, KAIROS, KAIROSWithResults, Account, AccountLoading, ProtocolDetail, ProtocolEditNew, NotFound. Plus `ErrorAlert.stories.tsx`.
3. **Static export:** `npm run storybook:export-mockups` builds Storybook and copies to `docs/design/mockups/static/`. Open `index.html` there for shareable 1:1 mockups.

---

### 2. Visual page builder (Plasmic, Builder.io, etc.)

- **Source of truth:** The builder’s canvas. You design visually; the tool exports or syncs React components.
- **Flow:** Design in the builder → export/sync to repo → app imports those components. Mockups and implementation are the same because implementation is generated from the design.
- **Pros:** True WYSIWYG; non-developers can change layout/copy in the tool.  
- **Cons:** Vendor lock-in; learning curve; build pipeline and theming (tokens) must align with the builder.

**Steps to adopt:**

1. Choose a builder (e.g. Plasmic) that supports design tokens and React export.
2. Rebuild key screens in the builder using the same tokens (e.g. teal primary, spacing).
3. Configure sync/export so the app consumes the generated components and stays 1:1 with the canvas.

---

### 3. Keep HTML mockups, generate React from them

- **Source of truth:** HTML/CSS mockups (removed in this repo).
- **Flow:** A build step or tool (e.g. html-to-react, or a curated conversion) turns mockup HTML into React components; the app uses those. When mockups change, re-run the step.
- **Pros:** Designers can edit HTML/CSS mockups directly.  
- **Cons:** Conversion is brittle (nested divs, class names); state and routing must be re-added; two syntaxes (HTML vs JSX) to maintain.

**Not recommended** unless the team is committed to HTML-first and investing in a robust conversion pipeline.

---

## Recommendation

Use **option 1 (React + Storybook)** so that:

- Screens are built once in React; Storybook is the design surface and documentation.
- Changing a page in code updates both the app and the “mockup” (story).
- Optional: export Storybook to static HTML for `docs/design/mockups/` when you need shareable static files.

Mockups are Storybook (and its static export in `docs/design/mockups/static/`); no separate HTML mockup folder.

---

## Status

- **Implementation** has been aligned with the current mockups (sidebar, Home/KAIROS/Account, Home copy, stats row, KAIROS page, Account intro and secondary Log out). See `phase2-signoff.md` and this folder.
- **1:1 process:** Implemented. Storybook is the design surface; change screens in `src/ui/` and stories in `src/ui/**/*.stories.tsx`. Run `npm run storybook` to view, `npm run storybook:export-mockups` to refresh `docs/design/mockups/static/`.
