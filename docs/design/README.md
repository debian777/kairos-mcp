# KAIROS design docs

Project design info for the KAIROS public UI. Harmonized with:

- **Generic guidelines:** `docs/guidelines/ux-design/` (INDEX, 00–10) — reusable UX rules, not KAIROS-specific.
- **Mockups:** `docs/design/mockups/default/` — browser canvas (HTML) mockups (approved teal theme). Possible theme colors saved in [theme-colors.md](theme-colors.md).
- **This folder:** KAIROS-specific design system, stack, and sign-off.

## Contents

| File | Purpose |
|------|---------|
| [designer-library.md](designer-library.md) | Extended reference: UX guidelines + KAIROS product context + tokens. The **kairos-ui-designer** skill (`.cursor/skills/kairos-ui-designer/SKILL.md`) is self-sufficient; use the library for deeper detail. |
| [ui-design-system.md](ui-design-system.md) | Design tokens and Tailwind extension for implementation. |
| [ui-frontend-stack-decision.md](ui-frontend-stack-decision.md) | Why React + Vite + Tailwind + shadcn/ui; comparison and repo layout. |
| [designer-checklist.md](designer-checklist.md) | **DRAFT:** KAIROS design sign-off protocol (compliance checklist). |
| [design-lint-report.md](design-lint-report.md) | Example design-lint report format and past results. |
| [kairos-logo-requirements.md](kairos-logo-requirements.md) | Logo brief for agencies: naming (KAIROS MCP), deliverables, colour, formats. |
| [logos/](../../logos/) | SVG logo mockups: wordmark, icon, lockup (light and dark variants). |
| [mockups/default/](mockups/default/) | HTML mockups (approved teal theme): 01-home-search, 03-protocol-detail, 04-error-recovery, 05-account, 06-protocol-create-edit, 07-kairos-actions. |
| [theme-colors.md](theme-colors.md) | Possible theme palettes (it-pro navy, it-pro-2 soft blue, blue KAIROS MCP brand) for future use. |

## Using the designer

Invoke **/kairos-ui-designer** with a plan or brief. The skill is self-contained; no need to open these docs unless you want extended reference.
