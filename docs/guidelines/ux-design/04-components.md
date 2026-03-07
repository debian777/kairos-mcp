# Components & States

> Every interactive component has defined default, hover, focus, active, disabled, and (where relevant) error states. Focus is visible; touch targets are large enough.

---

## State Matrix

For each component (buttons, inputs, cards, navigation, etc.) define and implement:

| State | Purpose | Notes |
|-------|---------|--------|
| **Default** | Rest state, clear affordance | Matches type (primary, secondary, etc.) |
| **Hover** | Cursor over element | Visual cue (darker bg, border, shadow); critical where cursor doesn’t change (e.g. touch) |
| **Focus** | Keyboard focus | Visible outline or ring; must not be removed. Same or stronger than hover. |
| **Active** | During press/click | Darker still, optional slight translate/shadow change for “pressed” feel |
| **Disabled** | Not interactive | Muted colours, no hover/focus/active; `cursor: not-allowed`; exclude from keyboard flow |
| **Error** | Invalid or destructive context | Distinct styling (e.g. red border); pair with message, not colour alone |

*Material Design and Apple HIG define component states; GenAI-UI-UX-Markdowns: buttons and forms specify these states with appearance and transition details.*

---

## Buttons (Summary)

- **Primary**: Solid, high-contrast background. Secondary: outline or lower contrast.
- **Hover**: Background darkens (e.g. ~10%); optional subtle shadow. Transition e.g. `0.2s ease-in-out`.
- **Focus**: Distinct outline or ring (e.g. `outline: 2px solid primary; outline-offset: 2px` or `box-shadow`). Don’t rely on focus-visible only if it’s removed elsewhere.
- **Active**: Darker again (~15%), optional `translateY(1px)` and reduced shadow; short transition (e.g. `0.1s`).
- **Disabled**: Reduced opacity, muted colours, `cursor: not-allowed`; no hover/focus/active. Omit from tab order or make inert.

*GenAI-UI-UX-Markdowns: 05_01_buttons — Normal, Hover, Focus, Active, Disabled with specifics.*

---

## Touch Targets

- **Minimum size**: At least **44×44 px** (or equivalent) for touch targets on touch devices. WCAG 2.2 includes Target Size (Minimum) 2.5.8 (AA).
- Keep **padding, icon size, and label placement** consistent across button/link variants so targets are predictable.

*Apple HIG and Material Design specify minimum touch targets; WCAG 2.2 Success Criterion 2.5.8.*

---

## Focus Visibility

- **All interactive elements** must be keyboard reachable and show a **visible focus indicator**. Never remove focus styling globally (e.g. `outline: none` without a replacement).
- **Example** (custom focus ring): `*:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }` or equivalent box-shadow. Ensure 3:1 contrast between focus ring and background.

*WCAG 2.2 Guideline 2.4 (Navigable), 2.4.7 Focus Visible; GenAI-UI-UX-Markdowns: "Ensure focus indicators are visible."*

---

## Consistency Across Variants

- Use the **same state rules** for primary, secondary, tertiary, and text buttons (only the default appearance changes). Same for input fields, cards, and nav items.
- Document **do/don’t** examples and code snippets in the design system so agents and developers apply states consistently.

---

**Next**: [Interaction, Motion & Feedback →](05-interaction.md)
