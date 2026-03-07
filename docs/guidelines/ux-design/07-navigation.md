# Navigation & Information Architecture

> Keep primary navigation shallow and descriptive. Make the current location obvious; use breadcrumbs for depth; add search when content volume justifies it.

---

## Primary Navigation

- **Shallow structure**: Prefer a small number of top-level items (e.g. 5–7) so users don’t hunt through deep menus. Nest only when the domain clearly has sub-sections.
- **Descriptive labels**: Use clear, task- or topic-based names. Avoid jargon or internal codenames unless the audience uses them.
- **Predictable location**: Place main nav in a consistent spot (top bar, side rail, or bottom nav on mobile). Don’t move primary nav between screens without reason.

*Material Design and Apple HIG define navigation patterns (navigation bar, rail, drawer, tabs) with consistent placement.*

---

## Current Location

- Make the **current location** obvious: active state on the current nav item (e.g. underline, background, or bold). Page title or heading should reinforce where the user is.
- Use **aria-current="page"** (or `"step"` in wizards) on the current link so assistive technologies announce it.

*WCAG 2.2 and best practice: users should always know where they are in the hierarchy.*

---

## Breadcrumbs

- Use **breadcrumbs** for deep hierarchies (e.g. Section > Subsection > Page). Breadcrumbs should be visible on the page and keyboard/screen-reader navigable.
- **Separator**: Clear visual separator between levels (e.g. `/`, `>`, or chevron). Don’t rely on colour alone to distinguish levels.
- **Last item**: Usually current page; often non-clickable or current only. Ensure the trail is in a logical tab order.

*Material Design and Apple HIG include breadcrumb patterns; common IA practice for multi-level sites.*

---

## Search

- When **content volume is high**, provide search so users can jump to content by keyword. Place search where it’s discoverable (e.g. in header or nav).
- **Results**: Clear, scannable results with titles and context (e.g. snippet or section). Ensure results are keyboard accessible and that focus is managed in modals/overlays.

---

## Nav Component States

Apply the same state discipline as other components (see [04 — Components](04-components.md)):

| State | Use |
|-------|-----|
| Normal | Default link/item style |
| Hover | Indicate interactivity |
| Focus | Visible focus ring for keyboard |
| Active/Current | Current page or section — distinct style and `aria-current` |
| Visited | Optional (e.g. different colour for links already visited) |
| Disabled | If a nav item is temporarily unavailable, style and make non-focusable or inert |

---

## Information Architecture

- **Group related items** in nav and in content. Use sectioning (e.g. `<nav>`, `<main>`, landmarks) so structure is programmatically clear.
- **Skip links**: Provide a “Skip to main content” (or similar) link at the start of the page so keyboard users can bypass repeated nav blocks. Make it visible on focus.

*WCAG 2.2 2.4.1 Bypass Blocks; GenAI-UI-UX-Markdowns: "Include skip links to bypass blocks of content."*

---

**Next**: [Accessibility →](08-accessibility.md)
