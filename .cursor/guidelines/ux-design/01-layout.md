# Layout & Visual Hierarchy

> Use clear hierarchy, consistent spacing, and grids so users can scan and act without guessing where things are.

---

## Visual Hierarchy

- Establish hierarchy via **size, weight, colour, and spacing**. Elements higher in importance can be larger, bolder, in a distinctive colour, or set off by more whitespace.
- **Group related elements** using proximity and alignment. Labels sit closer to their inputs than to unrelated blocks.
- Use **generous whitespace** to separate sections and improve scannability. Macro whitespace separates major blocks; micro whitespace separates lines and small elements.
- Keep **navigation and primary actions** in predictable locations (e.g. top or side nav, primary CTA in a consistent position).

*Material Design and Apple HIG emphasise consistent layout patterns and spatial relationships; GenAI-UI-UX-Markdowns: "Use a combination of scale, space, position, typography, color, and contrast to indicate importance."*

---

## Spacing & Grid Systems

Use a **base unit scale** (e.g. 4pt or 8pt) for padding, margins, and alignment so the layout has rhythm.

| Concept | Recommendation |
|--------|-----------------|
| Base unit | 4px or 8px |
| Padding/margin | Multiples of base (8, 16, 24, 32, 48) |
| Grid | 12-column flexible grid common for web |
| Line measure | 40–50 characters for multi-column body text |

- **Code**: Use CSS variables for spacing (e.g. `--space-1: 0.25rem; --space-2: 0.5rem;`) and apply via margin/padding.
- **Layout**: Prefer CSS Grid (`display: grid`, `grid-template-columns`) or Flexbox (`display: flex`, `flex-direction`, `justify-content`, `align-items`) for structure.
- **Sectioning**: Use semantic HTML5 (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `<section>`) and ARIA landmarks (`banner`, `navigation`, `main`, `complementary`) so structure is programmatically clear.

*GenAI-UI-UX-Markdowns: "Use consistent spacing values (e.g., a base unit scale like 8px)", "Consider a flexible twelve-column grid", "Use sectioning markup… WAI-ARIA roles like banner, navigation, main."*

---

## Responsive Behaviour

- Design for **responsiveness**: flexible grids and relative sizing so content adapts to viewport.
- Define **breakpoints** and document how patterns change (e.g. 768px, 1024px; stacking columns, hamburger menu).
- Prevent crucial content from being cropped on small screens; prioritise **mobile-first** when appropriate for the audience.
- Use **media queries** for breakpoints: `@media (min-width: 768px) { ... }`. Prefer relative units (%, rem, vw/vh) where suitable.

*GenAI-UI-UX-Markdowns: "Define key breakpoints (e.g., 768px, 1024px) and adaptation strategies", "Ensure the grid system prevents crucial content from being cropped on smaller devices."*

---

## Margins & Pacing

- **Margins**: Consistent margins frame content and protect it from being obscured or trimmed. Headings are closer to the text that **follows** than to the text above.
- **Pacing**: Use whitespace to create predictable "areas of rest" and control the pace of consumption. Avoid walls of content with no breathing room.

*GenAI-UI-UX-Markdowns: "Ensure headings are closer to the text that follows them than the text that precedes them", "Use asymmetric margins to activate negative space."*

---

## Code Organisation

- Structure **code** in a logical, unbroken flow. Most important content first (inverted pyramid). Don’t break the sequence of related elements with unrelated markup.
- Keep **layout structure** and **visual styling** separable: use HTML for structure, CSS for appearance.

---

**Next**: [Typography →](02-typography.md)
