# KAIROS design docs

Project design info for the KAIROS public UI. This folder is for design
reference, review criteria, and visual language. Implementation
architecture now lives under `docs/architecture/`.

- **Generic guidelines:** `docs/guidelines/ux-design/` (INDEX, 00–10)
  — reusable UX rules, not KAIROS-specific.
- **Storybook:** Run `npm run storybook` to review the current UI and
  design stories. Theme palettes are in
  [theme-colors.md](theme-colors.md).
- **This folder:** KAIROS-specific design system, review process, and
  brand guidance.

## Contents

| File | Purpose |
|------|---------|
| [designer-library.md](designer-library.md) | Extended reference: UX guidelines + KAIROS product context + tokens. The **kairos-ui-designer** skill (`.cursor/skills/kairos-ui-designer/SKILL.md`) is self-sufficient; use the library for deeper detail. |
| [ui-design-system.md](ui-design-system.md) | Design tokens and Tailwind extension for implementation. |
| [designer-checklist.md](designer-checklist.md) | **DRAFT:** KAIROS design sign-off protocol (compliance checklist). |
| [design-lint-report.md](design-lint-report.md) | Example design-lint report format and past results. |
| [kairos-logo-requirements.md](kairos-logo-requirements.md) | Logo brief for agencies: naming (KAIROS MCP), deliverables, colour, formats. |
| [logo/](../../logo/) | Official logo: [kaiiros-mcp.svg](../../logo/kaiiros-mcp.svg) (SVG). |
| [theme-colors.md](theme-colors.md) | Possible theme palettes (it-pro navy, it-pro-2 soft blue, blue KAIROS MCP brand) for future use. |
| [../architecture/ui-frontend-architecture.md](../architecture/ui-frontend-architecture.md) | UI frontend architecture, runtime boundaries, and current stack layout. |

## Using the designer

Invoke **/kairos-ui-designer** with a plan or brief. The skill is self-contained; no need to open these docs unless you want extended reference.
