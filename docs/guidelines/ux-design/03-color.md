# Color & Theming

> Define clear roles for colour. Use it to support meaning, never as the only cue. Meet WCAG contrast; keep semantic colours consistent.

---

## Colour Roles & Purpose

- **Primary, secondary, accent**: Define roles and use them consistently. Primary for key actions and brand; secondary for supporting actions; accent for emphasis or highlights.
- **Utility colours**: Use for copy and headers (e.g. text on background). Document acceptable use for each colour.
- **Semantic colours**: Use consistently across the product — e.g. red for destructive/error, green for success, amber for warning. Don’t rely on colour alone; pair with icon or text.
- **Calls to action**: Use primary (or high-contrast) colours so CTAs are clearly identifiable.

*Material Design 3 uses 26+ colour roles mapped to UI elements; GenAI-UI-UX-Markdowns: "Define primary, utility, and secondary/accent colors", "Calls to action should use primary colors."*

---

## Material Design 3 Colour System (Summary)

M3’s system includes:

- **Dynamic colour**: A single source colour (e.g. from wallpaper or in-app content) generates an accessible scheme. Supports user-generated and content-based sources. Products can use a **baseline static scheme** and switch to dynamic when ready.
- **Baseline (static) scheme**: Default light and dark themes with roles assigned. Easiest migration path from M2.
- **Colour roles**: Assigned by emphasis, container type, and relationship (e.g. surface, on-surface, primary, on-primary, error, on-error). Ensures contrast and consistent usage across schemes.
- **Accessible pairings**: Dark surfaces pair with light text; the system aims to meet contrast requirements by construction.
- **Three contrast levels** (May 2025): Standard, medium, and high so users can choose according to vision needs. Contrast levels are tokenised.

*Source: Material Design 3 — Color (m3.material.io/styles/color/overview).*

---

## WCAG Contrast Requirements

| Context | Level AA | Level AAA (aim where possible) |
|---------|----------|---------------------------------|
| Normal text | 4.5:1 | 7:1 |
| Large text (e.g. 18pt+ or 14pt+ bold) | 3:1 | 4.5:1 |
| UI components and graphics | 3:1 | — |

- **Contrast minimum**: Text and images of text have a contrast ratio of at least 4.5:1 (normal), 3:1 (large). (WCAG 2.2 Success Criterion 1.4.3.)
- Avoid small, low-contrast type and grey text on coloured backgrounds without checking ratios. Use tools to verify during development.

*WCAG 2.2; GenAI-UI-UX-Markdowns: "Meet WCAG 2.0 Level AA contrast ratio: 4.5:1 for normal text and 3:1 for large text", "Aim for Level AAA (7:1 / 4.5:1) where possible."*

---

## Don’t Rely on Colour Alone

- Never use **colour alone** to convey functional meaning (e.g. required field, error, selected state). Combine with borders, icons, or text.
- Where colour indicates state, provide a **redundant cue** (shape, label, pattern) so colour-blind and low-vision users can understand.

*WCAG 2.2 Guideline 1.4.1; GenAI-UI-UX-Markdowns: "Never rely on color alone to convey functional meaning."*

---

## Specification & Implementation

- **Document** hex values (or equivalent), names, and acceptable use for each colour. Include do’s and don’ts.
- **CSS variables**: Define colours as tokens for consistency, e.g. `--color-primary`, `--color-text`, `--color-text-heading`, `--color-error`, `--color-success`. Apply via `color: var(--color-text); background-color: var(--color-primary);`.
- **Tools**: Use contrast checkers during development to verify text/background pairs.

*GenAI-UI-UX-Markdowns: "Define colors using CSS variables for consistency", "Use tools to check contrast ratios during development."*

---

**Next**: [Components & States →](04-components.md)
