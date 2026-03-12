# Accessibility

> Follow WCAG 2.2 Level AA as a minimum. All interactive elements must be keyboard operable with visible focus; use semantic HTML and ARIA so assistive technologies can interpret the UI.

---

## WCAG 2.2 and the POUR Principles

WCAG 2.2 organises guidelines under four principles (POUR):

1. **Perceivable** — Information and UI components must be presentable in ways users can perceive (text alternatives, captions, adaptable content, distinguishable presentation).
2. **Operable** — UI and navigation must be operable (keyboard, enough time, seizures and physical reactions, navigable, input modalities).
3. **Understandable** — Information and operation must be understandable (readable, predictable, input assistance).
4. **Robust** — Content must be robust enough for a wide variety of user agents, including assistive technologies.

*Source: W3C WCAG 2.2 (www.w3.org/TR/WCAG22/).*

---

## Checklist: Key AA Success Criteria (Summary)

### Perceivable

| Criterion | Requirement |
|-----------|-------------|
| **1.1.1 Non-text Content** (A) | Non-text content has a text alternative (or is decorative and hidden from AT). |
| **1.3.1 Info and Relationships** (A) | Structure and relationships are programmatically determinable (semantic HTML, ARIA). |
| **1.3.2 Meaningful Sequence** (A) | Reading order can be programmatically determined. |
| **1.4.1 Use of Color** (A) | Color is not the only means of conveying information or indicating an action. |
| **1.4.3 Contrast (Minimum)** (AA) | Text and images of text: ≥4.5:1 (normal), ≥3:1 (large text). Exceptions: incidental, logotypes. |
| **1.4.4 Resize Text** (AA) | Text can be resized to 200% without loss of content or function. |
| **1.4.11 Non-text Contrast** (AA) | UI components and graphical objects: ≥3:1 against adjacent colours. |
| **1.4.13 Content on Hover or Focus** (AA) | Dismissible, hoverable, or persistent behaviour for additional content triggered by hover/focus. |

### Operable

| Criterion | Requirement |
|-----------|-------------|
| **2.1.1 Keyboard** (A) | All functionality operable through keyboard (no timing-dependent keystrokes except where path matters). |
| **2.1.2 No Keyboard Trap** (A) | Focus can leave any component via keyboard; user advised of exit method if non-standard. |
| **2.4.7 Focus Visible** (AA) | Keyboard focus indicator is visible. |
| **2.4.11 Focus Not Obscured (Minimum)** (AA) | When focused, the component is not entirely obscured by author-created content. |
| **2.5.8 Target Size (Minimum)** (AA) | Target size minimum (WCAG 2.2; see spec for dimensions). |

### Understandable

| Criterion | Requirement |
|-----------|-------------|
| **3.1.1 Language of Page** (A) | Default human language of the page is programmatically determinable (`lang` on `<html>`). |
| **3.2.1 On Focus** (A) | Components do not change context on receiving focus. |
| **3.2.2 On Input** (A) | Changing a setting does not automatically change context unless user has been advised. |
| **3.3.1 Error Identification** (A) | Input errors are identified and described in text. |
| **3.3.2 Labels or Instructions** (A) | Labels or instructions provided when content requires input. |

### Robust

| Criterion | Requirement |
|-----------|-------------|
| **4.1.2 Name, Role, Value** (A) | For UI components, name and role are programmatically determinable; states and values can be set/updated. |
| **4.1.3 Status Messages** (AA) | Status messages can be programmatically determined (e.g. `role="status"`, live regions). |

*Abbreviated from WCAG 2.2; full text and techniques: www.w3.org/TR/WCAG22/, www.w3.org/WAI/WCAG22/quickref/.*

---

## Keyboard Accessibility

- **All interactive elements** must be reachable and operable via keyboard (Tab, Enter, Space, arrow keys as appropriate). No keyboard trap; focus can leave every component.
- **Skip link**: Provide “Skip to main content” (or equivalent) at the start so keyboard users can bypass repeated nav. Make it visible on focus.
- **Focus order**: Tab order must match visual order and task flow. Use logical DOM order; avoid positive `tabindex` unless necessary and documented.

*GenAI-UI-UX-Markdowns: "Ensure all content and interactive elements are accessible and usable via keyboard", "Include skip links to bypass blocks of content."*

---

## Focus Styles

- **Visible focus**: When any component receives keyboard focus, show a clear focus indicator (outline, ring, or high-contrast border). Do not remove focus styling globally.
- **Example**: `*:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }` — ensure at least 3:1 contrast between focus ring and background. Prefer `:focus-visible` so mouse users don’t get a persistent ring on click.
- **Focus not obscured**: Ensure the focused component is not fully covered by overlays, sticky headers, or modals (WCAG 2.2 2.4.11).

---

## Semantic HTML and ARIA

- Use **semantic HTML** (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<button>`, `<label>`, etc.) so structure and roles are exposed without ARIA when possible.
- Use **ARIA** when HTML semantics are insufficient: `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-current`, `role="status"`, `role="alert"`, live regions. Don’t override native semantics with ARIA unless necessary.
- **Headings**: Use `<h1>`–`<h6>` for document structure; form a clear outline. Style with CSS; don’t use headings for visual effect only.
- **Language**: Set `<html lang="…">`; use `lang` on elements when the language changes (e.g. `<span lang="es">`).

*GenAI-UI-UX-Markdowns: "Use semantic HTML and WAI-ARIA roles to convey information, structure, and relationships", "Ensure the reading sequence is programmatically determinable."*

---

## Testing and Process

- **Test** with keyboard only (no mouse), and with a screen reader (e.g. NVDA, VoiceOver). Fix focus order, labels, and live regions.
- **Integrate** accessibility into the design and development process; don’t treat it as a final step. Include people with disabilities in usability work when possible.

*GenAI-UI-UX-Markdowns: "Accessibility should be integral to the practice of every member of the product team", "Conduct usability testing for accessibility."*

---

**Next**: [Design Systems & Documentation →](09-design-systems.md)
