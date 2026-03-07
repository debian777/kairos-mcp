# Typography

> Limit typefaces and use a clear scale. Size, weight, and spacing establish hierarchy and readability; contrast is mandatory.

---

## Font Selection & Scale

- **Limit typefaces**: One or two families, with a clear scale. Prefer **sans-serif** for UI and body on the web.
- **Text styles**: Define a small set (e.g. heading 1–3, body, caption, label) for consistency. Use **semantic naming** (e.g. `heading`, `body`, `caption`) not presentational names.
- **Sizing**: Use **relative units** (em, rem) rather than fixed px for text. Define a base font size (e.g. 16px at root) and scale from it. Text must be resizable up to **200%** without loss of content or function (WCAG 2.0 Level AA).

*Material Design and Apple HIG define type scales; GenAI-UI-UX-Markdowns: "Use relative sizes for text (e.g., em, rem)", "Ensure text can be resized up to 200% without loss of content or functionality."*

---

## Hierarchy & Readability

- Use **size, weight, and line spacing** to establish hierarchy. Headings are larger and/or bolder; body has comfortable line-height.
- **Line height**: Proportionally set (e.g. 1.4–1.6 for body). Tighter for headings if needed.
- **Line length**: Avoid long lines; aim for **40–75 characters** per line for body text. Use max-width or grid to constrain.
- **Contrast**: Maintain sufficient contrast between text and background (see [03 — Color](03-color.md) and [08 — Accessibility](08-accessibility.md)).

*GenAI-UI-UX-Markdowns: "Provide enough space between lines of text (leading/line-height)", "Use different typefaces, sizes, or styles to establish hierarchy."*

---

## Letter Spacing & Alignment

- **Letter-spacing**: Use sparingly. Add letter-spacing to **uppercase** text for polish (e.g. `letter-spacing: 0.1em`). Avoid condensed/tight adjustments that hurt readability.
- **Alignment**: **Left-align** body text for readability. Reserve centre/right for specific patterns (headings, captions).
- **Baseline grid**: Vertical rhythm can be based on type size and leading for a consistent baseline grid.

*GenAI-UI-UX-Markdowns: "Left-align body text for readability", "Add letter-spacing to uppercase text for polish."*

---

## Emphasis & Links

- Use **emphasis** (bold, italic, colour) sparingly so it stays meaningful. Convey emphasis in code with semantic tags (`<strong>`, `<em>`) so assistive tech can use it.
- **Underline** only for links. Differentiate areas with weight/size of the same typeface rather than extra decoration.
- **Font weight**: Limit choices (e.g. regular, medium, bold) to keep the system coherent.

*GenAI-UI-UX-Markdowns: "Use underlining only for links", "Convey emphasis in code using semantic tags like <strong> and <em>."*

---

## Code Conventions

| Element | Example |
|---------|---------|
| Body | `.body-text { font-size: 1rem; line-height: 1.6; }` |
| Headings | `h1 { font-size: 2.5rem; line-height: 1.2; }` with margin for spacing |
| Semantic tags | `<h1>`–`<h6>`, `<p>`, `<strong>`, `<em>` for structure |
| Uppercase | `letter-spacing: 0.1em` for all-caps labels |

Ensure styles cascade from semantic structure; avoid styling that contradicts document hierarchy.

---

**Next**: [Color & Theming →](03-color.md)
