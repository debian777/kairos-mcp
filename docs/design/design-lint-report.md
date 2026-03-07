# Design-lint report — KAIROS public UI

Validated against [docs/guidelines/ux-design/](../guidelines/ux-design/) (INDEX, 03-color, 04-components, 06-forms, 08-accessibility). The design-lint prompt and report format are also defined in the kairos-ui-designer skill (§11).

## Scope

- **Screens:** Home (search), Run (challenge/solution/attest), Protocol detail.
- **Components:** Layout (nav, skip link), ErrorAlert, Button (shadcn), form inputs and textareas.

## Violations found and fixes applied

| Guideline | Issue | Fix |
|-----------|--------|-----|
| **08 — Accessibility** | No skip link for keyboard users. | Added “Skip to main content” link at start of Layout; visible on focus only (`left-[-9999px]` / `focus:left-4`). |
| **08 — Focus visible** | Fallback for any interactive element without explicit focus style. | Added global `a:focus-visible`, `button:focus-visible`, `input:focus-visible`, `textarea:focus-visible`, `select:focus-visible` with 2px outline and `--color-primary` in `ui/src/index.css`. |
| **07 — Navigation** | Current location not programmatically indicated. | Set `aria-current="page"` on nav links when `location.pathname` matches. |
| **06 — Forms** | — | All inputs have associated `<label>` with `htmlFor`/`id`; placeholders used as hints only. |
| **04 — Touch targets** | — | Buttons and nav links use `min-h-[44px]` (and `min-w-[44px]` where appropriate). |
| **03 — Color** | — | ErrorAlert uses text + border + background (not color alone). |
| **08 — Semantic HTML** | — | `<main id="main-content">`, `<nav aria-label="Main">`, `<header role="banner">`, sections with `aria-labelledby` where applicable. |

## Checks performed

- **Focus:** All interactive elements have visible focus (component-level or global fallback).
- **Labels:** Search input, solution textarea, attest outcome/message have visible labels and correct association.
- **Errors:** API errors surface `message` and `next_action`; ErrorAlert has `role="alert"` and `aria-live="polite"`.
- **Language:** `index.html` has `lang="en"`.
- **Contrast:** Design tokens (03-color, tokens.css) define roles; implementation uses tokens for text and UI components.

## Result

No outstanding violations. All listed fixes have been applied in the codebase.
