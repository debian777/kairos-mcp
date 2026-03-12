# KAIROS UI design system

Design tokens and rules derived from [UX guidelines 00–03, 09](docs/guidelines/ux-design/INDEX.md). Use these tokens in `ui/src/theme/tokens.css` and Tailwind config. **User experience is the #1 priority;** all tokens support accessibility (WCAG 2.2 AA), consistency, and clarity.

---

## Color tokens

Semantic names; never rely on color alone for meaning. Pair with icon or text.

| Token | Use | Value (light default) | Contrast note |
|-------|-----|----------------------|---------------|
| `--color-primary` | Key actions, CTAs, brand | `#0d9488` (teal 600) | On-primary text: white |
| `--color-primary-hover` | Primary button hover | `#0f766e` (teal 700) |
| `--color-primary-focus` | Primary focus ring | Same as primary; ring 2px |
| `--color-secondary` | Supporting actions | `#64748b` (slate 500) |
| `--color-accent` | Emphasis, highlights | `#0ea5e9` (sky 500) |
| `--color-text` | Body copy | `#1e293b` | On background ≥ 4.5:1 |
| `--color-text-heading` | Headings | `#0f172a` |
| `--color-text-muted` | Secondary text | `#64748b` |
| `--color-surface` | Page/card background | `#ffffff` |
| `--color-surface-elevated` | Cards, dropdowns | `#f8fafc` |
| `--color-border` | Borders, dividers | `#e2e8f0` |
| `--color-error` | Error text, destructive | `#dc2626` | Pair with icon/label |
| `--color-error-bg` | Error background | `#fef2f2` |
| `--color-success` | Success | `#16a34a` |
| `--color-warning` | Warning | `#d97706` |
| `--color-focus-ring` | Focus visible outline | `var(--color-primary)` | 2px, offset 2px; ≥ 3:1 |

Base font size at root: `16px`. Text resizable to 200%.

---

## Spacing tokens

Base unit **8px**. Multiples for padding, margin, gap.

| Token | Value | Use |
|-------|--------|-----|
| `--space-0` | 0 | Reset |
| `--space-1` | 0.25rem (4px) | Micro (icon padding) |
| `--space-2` | 0.5rem (8px) | Inline gap, tight padding |
| `--space-3` | 0.75rem (12px) | Small padding |
| `--space-4` | 1rem (16px) | Default padding |
| `--space-5` | 1.25rem (20px) | |
| `--space-6` | 1.5rem (24px) | Section padding |
| `--space-8` | 2rem (32px) | Block spacing |
| `--space-10` | 2.5rem (40px) | |
| `--space-12` | 3rem (48px) | Macro spacing |

Use for margin, padding, gap. Grid: 12-column flexible; section with semantic HTML5 + ARIA landmarks.

---

## Typography tokens

Relative units (rem). Semantic roles: heading, body, caption, label.

| Token | Size | Line-height | Use |
|-------|------|-------------|-----|
| `--font-sans` | — | — | UI font stack: system-ui, sans-serif |
| `--font-size-xs` | 0.75rem | 1.25 | Caption, label |
| `--font-size-sm` | 0.875rem | 1.4 | Small body |
| `--font-size-base` | 1rem | 1.6 | Body |
| `--font-size-lg` | 1.125rem | 1.5 | Lead |
| `--font-size-xl` | 1.25rem | 1.4 | H3 |
| `--font-size-2xl` | 1.5rem | 1.3 | H2 |
| `--font-size-3xl` | 2rem | 1.2 | H1 |
| `--font-weight-normal` | 400 | — | Body |
| `--font-weight-medium` | 500 | — | Labels, buttons |
| `--font-weight-semibold` | 600 | — | Headings |
| `--font-weight-bold` | 700 | — | Strong emphasis |
| `--line-height-tight` | 1.25 | — | Labels |
| `--line-height-normal` | 1.5 | — | UI |
| `--line-height-relaxed` | 1.6 | — | Body |
| `--letter-spacing-uppercase` | 0.1em | — | All-caps labels |

Line length: 40–75 characters for body (max-width or grid). Left-align body text.

---

## Component tokens

- **Touch targets**: min 44×44px (WCAG 2.2 Target Size).
- **Focus**: `outline: 2px solid var(--color-focus-ring); outline-offset: 2px` or equivalent; visible on `:focus-visible`.
- **Border radius**: `--radius-sm: 0.25rem`, `--radius-md: 0.375rem`, `--radius-lg: 0.5rem` for consistency.
- **States**: default, hover, focus, active, disabled, error — document for each component; no color-only state.

---

## Motion

- **Reduce motion**: Respect `prefers-reduced-motion: reduce`; disable or shorten animations.
- **Feedback**: Instant visual feedback on interaction; loading/progress communicated.
- **Duration**: Short (150–250ms) for UI transitions.

---

## Tailwind extension

Map tokens into Tailwind so utilities use the design system:

- **Colors**: Extend `theme.colors` with semantic keys (primary, secondary, surface, error, etc.) from `--color-*`.
- **Spacing**: Extend `theme.spacing` with `--space-*` or use the same scale (2, 4, 6 = 8px, 16px, 24px).
- **Font size / line-height**: Extend `theme.fontSize` and `theme.lineHeight` from typography tokens.
- **Border radius**: Extend from `--radius-*`.

Use `@theme` in Tailwind v4 or `theme: { extend: { ... } }` in tailwind.config.ts; reference CSS variables so one source of truth (tokens.css) drives both raw CSS and Tailwind.
