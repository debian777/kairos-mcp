# Forms & Data Input

> Use clear labels, logical tab order, and inline validation. Never rely on placeholders as the only label; show constraints up front.

---

## Labels

- **Always provide visible labels** for inputs. Use `<label>` (or `aria-label` / `aria-labelledby` where appropriate) so purpose is programmatically available.
- **Do not use placeholders as the only label**. Placeholders can hint at format or example; they disappear on focus and are not a substitute for a persistent label. Position labels consistently (e.g. above the input, with less space below the label than above so the pair is grouped).
- **Associate label and input** so screen readers announce the label with the field (e.g. `<label for="id">` with `id` on the input).

*WCAG 2.2; GenAI-UI-UX-Markdowns: "Labels must be correctly associated with inputs for accessibility", "Labels (outside the input field) should be clearly associated using <label> tags."*

---

## Form States (Text Inputs / Textareas)

| State | Appearance / behaviour |
|-------|-------------------------|
| **Normal** | Border, background, text colour defined. Label visible and associated. |
| **Placeholder** | Lighter text for hint/example; not the only identification. |
| **Hover** | Subtle border change; e.g. `transition: border-color 0.2s ease-in-out`. |
| **Focus** | Prominent outline or box-shadow; clear which field is active. |
| **Error** | Red (or semantic error) border; error message **near the field** (e.g. below), not only in a modal. Use icon or text in addition to colour. Label or message in error colour. |
| **Disabled** | Muted background and text; `cursor: not-allowed`; no hover/focus. |
| **Filled** | Same as normal unless design requires a “filled” indicator. |

*GenAI-UI-UX-Markdowns: 05_02_forms — Normal, Placeholder, Hover, Focus, Error, Disabled, Filled with specifics.*

---

## Validation & Errors

- **Validate inline** where possible (on blur or submit), with messages next to the field.
- **Error messages** must be understandable and actionable (“Enter a valid email” not “Invalid input”). Indicate what went wrong and how to fix it.
- **Don’t rely on colour alone**: combine error colour with icon and/or text. Ensure contrast for the error text.
- **Summary**: For longer forms, an error summary at the top (with links to fields) helps keyboard and screen-reader users. Gov.UK pattern: list errors and link to each field.

*Inclusive form patterns; WCAG 2.2 Understandable (3.3) Input Assistance.*

---

## Tab Order & Grouping

- **Logical tab order**: Fields should be focusable in a order that matches the visual layout and the task flow. Group related fields (e.g. `fieldset` + `legend` for sections).
- **Constraints up front**: Show format, length, or required status in the label or hint text so users know rules before typing (e.g. “Email”, “Max 200 characters”).

---

## Code Conventions

- Use semantic form elements: `<form>`, `<label>`, `<input>`, `<textarea>`, `<fieldset>`, `<legend>`.
- Connect labels: `for`/`id` or wrap input inside `<label>`.
- For errors: `aria-invalid="true"` and `aria-describedby` pointing to the error message element so screen readers announce the error.

---

**Next**: [Navigation & Information Architecture →](07-navigation.md)
