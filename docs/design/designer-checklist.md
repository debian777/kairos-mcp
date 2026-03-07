# DRAFT: KAIROS design sign-off protocol

> **Status: DRAFT.** This checklist is the draft KAIROS protocol for design sign-off. It aligns the final design (mockups or implemented UI) with the kairos-ui-designer skill and project design rules.

Step-by-step compliance of the **final design** (mockups or implemented UI) against the kairos-ui-designer skill (`.cursor/skills/kairos-ui-designer/SKILL.md`) and [designer-library.md](designer-library.md). Use this after mockups are approved or before design sign-off. Tick each item when verified.

**How to use:** Work through sections in order. For each item, confirm the design complies (✓) or document the violation and fix (✗ + note). All ✓ required for sign-off unless explicitly waived and documented.

---

## 1. Scope and product alignment (Prompt)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 1.1 | UI is **account management + protocol browser** only (view, create, edit protocols). | Prompt § What you are designing | | |
| 1.2 | **Run/execute** is not in the UI; "How to run" is copy + link on protocol detail only. | Prompt § Out of scope | | |
| 1.3 | **Keycloak** is not managed in the UI (no login form, no IdP picker). | Prompt § Out of scope | | |
| 1.4 | **Group management** is not present unless product has committed to it. | Prompt § Out of scope | | |
| 1.5 | **Monitoring/admin** UI is not in scope. | Prompt § Out of scope | | |
| 1.6 | Account shows **identity (name/email)** and **Log out**; optional profile/language. | Prompt § Screens 1 | | |
| 1.7 | Home/search is **protocol browser**: query, results, View / Refine / Create (not Run). | Prompt § Screens 2 | | |
| 1.8 | Protocol view shows **steps, triggers, completion**, Edit/Duplicate, "How to use" copy. | Prompt § Screens 3 | | |
| 1.9 | Protocol create/edit is a **familiar create/edit flow** (markdown + challenge blocks when applicable). | Prompt § Screens 4 | | |
| 1.10 | **Error/recovery** states exist on all screens with message + next_action where APIs provide them. | Prompt § Screens 5 | | |

---

## 2. Design rules (Prompt)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 2.1 | **Rule #1:** Decisions favour end-user outcomes (accessibility, clarity, consistency, feedback). | Prompt § Rule #1 | | |
| 2.2 | **Rule #2 — Familiar patterns:** Nav, search, list, detail, edit, account only; no new concepts. | Prompt § No-learning UI | | |
| 2.3 | **Rule #2 — User language:** "protocol", "workflow", "steps", "View", "Edit"; no chain/dump/attest/nonce in UI unless explained in one line. | Prompt § No-learning UI | | |
| 2.4 | **Rule #2 — One purpose per screen:** Where am I and what can I do; primary action visible. | Prompt § No-learning UI | | |
| 2.5 | **Rule #2 — Answer in UI:** Predictable questions (e.g. "How do I run this?") answered in the UI. | Prompt § No-learning UI | | |
| 2.6 | **Rule #3:** Visible focus on every interactive element. | Prompt § WCAG 2.2 AA | | |
| 2.7 | **Rule #3:** Contrast: text ≥ 4.5:1, large text ≥ 3:1, UI ≥ 3:1. | Library § 03, 08 | | |
| 2.8 | **Rule #3:** Keyboard operable; no keyboard trap; skip link present. | Library § 08 | | |
| 2.9 | **Rule #3:** Semantic HTML; ARIA where needed; touch targets ≥ 44×44px. | Library § 04, 08 | | |
| 2.10 | **Rule #3:** All inputs have visible labels (no placeholder-only labels). | Library § 06 | | |
| 2.11 | **Rule #3:** Colour is never the sole indicator of meaning. | Library § 03, 08 | | |
| 2.12 | **Rule #4:** Every interactive component has default, hover, focus, active, disabled, error states (documented or implemented). | Prompt § Rule #4; Library § 04 | | |
| 2.13 | **Rule #5:** Every user action has clear, timely feedback; loading and errors communicated. | Prompt § Rule #5; Library § 05 | | |

---

## 3. Navigation (Prompt + Library 07)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 3.1 | Primary nav has **3–5 top-level items** (e.g. Home, Account; optionally My protocols). | Prompt § Navigation | | |
| 3.2 | **Current location** is obvious (active nav state, page heading). | Library § 07 | | |
| 3.3 | Current nav link has **aria-current="page"**. | Library § 07, 08 | | |
| 3.4 | **Skip to main content** link at page start; visible on focus. | Library § 07, 08 | | |
| 3.5 | Nav labels are **descriptive** (task/topic, not jargon). | Library § 07 | | |
| 3.6 | Nav in **predictable location** (top bar or side); not moved between screens. | Library § 07 | | |

---

## 4. Screen-by-screen compliance

### 4.1 Account screen

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 4.1.1 | Authenticated user (name/email from session) is shown. | Prompt § Account | | |
| 4.1.2 | Log out control is present and clearly labeled. | Prompt § Account | | |
| 4.1.3 | No login form (Keycloak handles login). | Prompt § Out of scope | | |
| 4.1.4 | All interactive elements have visible focus and ≥ 44×44px target. | Library § 04, 08 | | |

### 4.2 Home / search (protocol browser)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 4.2.1 | Search input has a **visible label** (not placeholder-only). | Prompt § Home; Library § 06 | | |
| 4.2.2 | Results show title, short description; score and role (match/refine/create) are clear. | Prompt § Home; Library § Search API | | |
| 4.2.3 | Actions per result: **View** (matches), **Refine search** (refine), **Create new** (create). **No Run.** | Prompt § Home | | |
| 4.2.4 | Empty state: "No protocols found" (or equivalent) with Refine and Create options. | Prompt § Home | | |
| 4.2.5 | Results are keyboard accessible and scannable. | Library § 07 | | |

### 4.3 Protocol view (detail)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 4.3.1 | Protocol **title** and metadata (e.g. URI, read-only) are shown. | Prompt § Protocol view | | |
| 4.3.2 | **Steps list** with labels and challenge types (shell, mcp, user_input, comment) where applicable. | Prompt § Protocol view; Library § Protocol structure | | |
| 4.3.3 | **Natural language triggers** and **completion rule** sections present. | Prompt § Protocol view | | |
| 4.3.4 | **"How to use this protocol"**: one line or link (e.g. "Use in Cursor (MCP) or via CLI" + docs link). **No step-by-step run UI.** | Prompt § Protocol view | | |
| 4.3.5 | Actions: **Edit**, **Duplicate** (or Create from template). No Run. | Prompt § Protocol view | | |

### 4.4 Protocol create / edit

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 4.4.1 | Create new and edit existing flows are **familiar** (save, cancel, validation). | Prompt § Protocol create/edit | | |
| 4.4.2 | Markdown + challenge blocks aligned with **challenge types** in library (for display/editing). | Prompt § Protocol create/edit; Library § Challenge types | | |
| 4.4.3 | All form fields have **visible labels** and logical tab order. | Library § 06 | | |
| 4.4.4 | Validation errors are **inline**, actionable, and not colour-only. | Library § 06, 08 | | |

### 4.5 Error / recovery states

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 4.5.1 | **Inline error alerts** on every screen where errors can occur. | Prompt § Error/recovery | | |
| 4.5.2 | Error UI shows **message** and, when available, **next_action** (or user-friendly translation). | Prompt § Error; Library § Error recovery UX | | |
| 4.5.3 | Recovery options are clear: **retry**, **go back**, or support. | Prompt § Error; Library § 00 | | |
| 4.5.4 | Error states for: API failure, 404, auth expired, validation errors. | Prompt § Error/recovery | | |
| 4.5.5 | Errors use **role="alert"** and are not conveyed by colour alone. | Library § 08 | | |

---

## 5. Layout and visual hierarchy (Library 01)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 5.1 | Hierarchy via size, weight, colour, spacing; related elements grouped. | Library § 01 | | |
| 5.2 | **Spacing** uses base unit 8px (multiples: 8, 16, 24, 32, 48). | Library § 01, Design system tokens | | |
| 5.3 | Line measure for body text **40–75 characters** (max-width or grid). | Library § 01, 02 | | |
| 5.4 | Sectioning uses semantic structure (header, nav, main, section) / ARIA landmarks. | Library § 01, 08 | | |
| 5.5 | Responsive: breakpoints considered (e.g. 768px, 1024px); no crucial content cropped. | Library § 01 | | |
| 5.6 | Headings are **closer to following text** than to text above. | Library § 01 | | |

---

## 6. Typography (Library 02)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 6.1 | One or two type families; **sans-serif** for UI; semantic roles (heading, body, caption, label). | Library § 02 | | |
| 6.2 | **Relative units** (rem) for text; base 16px; text resizable to 200%. | Library § 02, 08 | | |
| 6.3 | Line-height ~1.4–1.6 for body; left-align body text. | Library § 02 | | |
| 6.4 | Underline **only for links**; emphasis via semantic tags where applicable. | Library § 02 | | |
| 6.5 | Type scale matches design system (xs–3xl) where tokens are defined. | Library § Design system tokens | | |

---

## 7. Color and contrast (Library 03, 08)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 7.1 | **Colour roles** used consistently: primary (CTAs), secondary, accent, semantic (error/success/warning). | Library § 03 | | |
| 7.2 | **Contrast:** Normal text ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1. | Library § 03, 08 | | |
| 7.3 | **No colour-only meaning:** Error/required/selected have icon or text as well. | Library § 03, 08 | | |
| 7.4 | Colours reference **tokens** (e.g. `--color-primary`, `--color-error`) not raw hex in specs. | Library § Design system tokens | | |
| 7.5 | Primary colour teal per design system (`#0d9488`). | Prompt § Design system; Library § Color tokens | | |

---

## 8. Components and states (Library 04)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 8.1 | **State matrix** for buttons, inputs, links, cards, nav: default, hover, focus, active, disabled, error. | Library § 04 | | |
| 8.2 | **Focus:** 2px outline, offset 2px, ≥ 3:1 contrast with background; visible on :focus-visible. | Library § 04, 08 | | |
| 8.3 | **Touch targets** ≥ 44×44px for all interactive elements. | Library § 04, 08 | | |
| 8.4 | Disabled: muted, cursor not-allowed, no hover/focus/active; excluded from tab order where appropriate. | Library § 04 | | |
| 8.5 | Error state: border + message + icon/text (not colour alone). | Library § 04, 06 | | |

---

## 9. Forms (Library 06)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 9.1 | **Visible labels** for all inputs; label associated with input (for/id or aria-label). | Library § 06 | | |
| 9.2 | **Placeholder** is not the only label; placeholder for hint/example only. | Library § 06 | | |
| 9.3 | Form states: normal, placeholder, hover, focus, error, disabled (and filled if needed). | Library § 06 | | |
| 9.4 | **Validation:** inline; messages next to field; actionable wording. | Library § 06 | | |
| 9.5 | **Tab order** logical; related fields grouped (e.g. fieldset/legend). | Library § 06 | | |
| 9.6 | Errors: **aria-invalid="true"** and **aria-describedby** to error message. | Library § 06, 08 | | |

---

## 10. Interaction and feedback (Library 05)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 10.1 | **Instant feedback** on button press (active state or loading). | Library § 05 | | |
| 10.2 | Form submit: **loading state** then success or inline error. | Library § 05 | | |
| 10.3 | **Motion** is purposeful; respects **prefers-reduced-motion**. | Library § 05 | | |
| 10.4 | No long blocking animations for navigation. | Library § 05 | | |

---

## 11. Accessibility (Library 08)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 11.1 | **Keyboard:** All functionality operable via keyboard; no keyboard trap. | Library § 08 | | |
| 11.2 | **Focus visible** on all interactive elements; focus not obscured. | Library § 08 | | |
| 11.3 | **Semantic HTML:** header, nav, main, button, label, headings h1–h6. | Library § 08 | | |
| 11.4 | **ARIA** where needed: aria-label, aria-describedby, aria-invalid, aria-current, role="alert", live regions. | Library § 08 | | |
| 11.5 | **Language:** `<html lang="en">` (or appropriate). | Library § 08 | | |
| 11.6 | **Name, role, value** programmatically determinable for UI components. | Library § 08 | | |
| 11.7 | **Status messages** (e.g. success/error) programmatically determinable (role="status"/alert, live regions). | Library § 08 | | |

---

## 12. Design system tokens (Library)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 12.1 | **Colour** uses token names (--color-primary, --color-text, --color-error, etc.). | Library § Design system | | |
| 12.2 | **Spacing** uses 8px base scale (--space-1 through --space-12 or equivalent). | Library § Design system | | |
| 12.3 | **Typography** uses scale (xs–3xl) and weights (400, 500, 600, 700). | Library § Design system | | |
| 12.4 | **Border radius** consistent (e.g. --radius-sm, --radius-md, --radius-lg). | Library § Design system | | |
| 12.5 | **Motion** 150–250ms for transitions; reduce-motion honoured. | Library § Design system | | |

---

## 13. "What humans need" (Prompt quick reference)

| # | User thought | Design answers it | ✓ / ✗ | Notes |
|---|----------------|------------------|--------|--------|
| 13.1 | "Where am I?" | Product name, tagline, obvious nav, current location | | |
| 13.2 | "Find a protocol" | Search/browse, results with View action | | |
| 13.3 | "View or edit" | Detail page (read-only), Edit button, Create flow | | |
| 13.4 | "Who am I?" | Account: name/email + Log out | | |
| 13.5 | "How do I run this?" | One line on protocol detail + docs link | | |
| 13.6 | "Something broke" | Error message, retry, go back | | |

---

## 14. Design-lint (Library 10)

| # | Check | Ref | ✓ / ✗ | Notes |
|---|--------|-----|--------|--------|
| 14.1 | Design has been **reviewed** against guidelines: contrast, focus, states, labels, semantics, touch targets, colour-only indicators. | Library § 10 | | |
| 14.2 | Any **violations** from the review are documented and **fixed or waived** with rationale. | Library § 10 | | |

---

## Sign-off

| Role | Name/Date | Signature / note |
|------|-----------|------------------|
| Designer | | |
| Reviewer | | |
| Product / stakeholder | | |

**Checklist version:** 1.0  
**References:** kairos-ui-designer skill (`.cursor/skills/kairos-ui-designer/SKILL.md`), [designer-library.md](designer-library.md)
