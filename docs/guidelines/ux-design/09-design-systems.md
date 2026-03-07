# Design Systems & Documentation

> Centralise tokens and components; document usage with do/don’t examples and code. Keep a changelog so teams and agents can track changes.

---

## Tokens

- **Centralise** design tokens for colour, spacing, typography, motion, and elevation so all platforms and components use the same values.
- **Naming**: Use semantic names (e.g. `--color-primary`, `--color-text`, `--color-surface`, `--space-2`, `--font-size-body`, `--line-height-tight`) rather than raw values in component code.
- **Implementation**: Expose tokens as CSS variables, theme objects, or design-tool variables. Reference tokens in components; avoid hard-coded hex or px for core design decisions.

*Material Design 3 and Apple HIG use token systems; GenAI-UI-UX-Markdowns: "Define colors using CSS variables for consistency."*

---

## Components

- **Component library**: Buttons, inputs, cards, navigation, etc. should be defined once with all states (default, hover, focus, active, disabled, error) and reused.
- **Document** each component with: name, purpose, variants, states, props/slots, and code snippets. Include **do/don’t** examples so misuse is obvious.
- **Code snippets**: Provide copy-pasteable or generated snippets for the main stacks (e.g. HTML/CSS, React, or design-tool usage) so agents and developers apply the system correctly.

*Material Design and Apple HIG provide component specs and code; GenAI-UI-UX-Markdowns includes implementation notes per component type.*

---

## Documentation Practices

- **Single source of truth**: Keep guidelines and tokens in one place (repo, design tool, or docs site). Link from tickets and specs so everyone and every agent uses the same rules.
- **Usage guidelines**: For each token and component, state when to use it and when not to. Document edge cases (e.g. disabled buttons, long labels).
- **Changelog**: Maintain a design-system changelog (version or date) so product teams and AI agents can see what changed and when. Reference it in release notes when components or tokens change.

*GenAI-UI-UX-Markdowns: "Use documentation as a source of truth to reduce the chance of multiple rogue variations."*

---

## What to Document

| Item | Contents |
|------|----------|
| Colour tokens | Name, value, use (e.g. primary, text, error). Contrast notes. |
| Spacing tokens | Scale (e.g. 4/8/16/24/32). Usage (padding, margin, gap). |
| Typography | Scale, weights, line-heights. Mapping to semantic roles (heading, body, caption). |
| Components | States, variants, accessibility notes (focus, ARIA), code. |
| Motion | Duration/easing or spring tokens; reduce-motion behaviour. |

---

## For AI Agents

- When generating UI, **reference the design system** (this guide or project-specific tokens) so output uses the same spacing, colours, and components.
- When **reviewing** UI, check against tokens and component states; flag hard-coded values or missing states (e.g. no focus style, placeholder used as label).

---

**Next**: [AI Agent Usage →](10-ai-usage.md)
