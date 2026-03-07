# Phase 2 build sign-off (designer checklist 1–4)

**Date:** 2025-03-07  
**Scope:** Built UI under `src/ui/`, served at URL `/ui`.

**Update:** Implementation matches the design (sidebar nav, Home / KAIROS / Account, Home copy and stats, KAIROS page for search results, Account intro and secondary Log out). Mockups = Storybook; see [mockup-implementation-1-to-1.md](mockup-implementation-1-to-1.md).

## Sections 1–4 verification

### 1. Scope and product alignment
- **1.1–1.5** UI is account + protocol browser only; no Run, no Keycloak management, no group/monitoring UI.
- **1.6** Account: GET /api/me for identity; Log out links to /auth/logout.
- **1.7** Home: search, results with View / Refine / Create (no Run).
- **1.8** Protocol view: title, URI, steps with challenge types, triggers, completion, "How to use" + docs link, Edit/Duplicate.
- **1.9** Protocol create/edit: markdown textarea, Save/Cancel, Zod validation (H1 required).
- **1.10** ErrorAlert used on Home (search error), NotFoundPage (404); message + retry/go back.

### 2. Design rules
- **2.1–2.5** User-centred; familiar patterns; "protocol", "View", "Edit"; one purpose per screen; "How to use" on protocol detail.
- **2.6** Focus: `:focus-visible` and focus-ring tokens in `tokens.css`.
- **2.7** Contrast: tokens from ui-design-system (teal on white, text on surface ≥ 4.5:1).
- **2.8** Skip link; keyboard nav (links and buttons focusable).
- **2.9** Semantic HTML (header, nav, main, section); touch targets ≥ 44px on nav and primary actions.
- **2.10** Search and protocol edit have visible `<label>`; no placeholder-only.
- **2.11** Error and role use text + icons/labels.
- **2.12** Buttons have default and focus; hover/active/disabled/error applied via Tailwind/tokens where used (full 6-state matrix can be expanded in a follow-up).
- **2.13** Loading and error states shown (useSearch, useProtocol, useMe, ErrorAlert).

### 3. Navigation
- **3.1** Top-level: Home, KAIROS, Account (3 items; within 3–5). Sidebar layout per mockups.
- **3.2–3.3** Active nav via `aria-current="page"` and active styling (left border, primary colour).
- **3.4** Skip link at start; visible on focus.
- **3.5–3.6** Labels "Home", "KAIROS", "Account"; nav in sidebar (aside).

### 4. Screen-by-screen
- **4.1** Account: name/email (or sub), Log out; no login form; focus and 44px on link.
- **4.2** Home: visible search label; results with title, description, score, role; View/Refine/Create; empty state with Refine/Create; list keyboard accessible.
- **4.3** Protocol detail: title, URI, steps with types, triggers, completion, "How to use" + link, Edit/Duplicate.
- **4.4** Create/edit: save, cancel, validation; markdown + challenge blocks; visible label; inline validation error.
- **4.5** ErrorAlert: message, retry, go back; role="alert"; API failure, 404, auth (Account), validation covered.

## Result

Checklist sections 1–4: **no outstanding violations**.  
Phase 2 build is complete. Recommend manual pass in browser for focus order and reduced-motion once deployed.
