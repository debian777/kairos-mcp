---
kind: frontend_style
name: KAIROS UI Design System — CSS Variables + Tailwind v4 + Theme Tokens
category: frontend_style
scope:
    - '**'
source_files:
    - src/ui/index.css
    - src/ui/theme/tokens.css
    - src/ui/theme/tokens-shared.css
    - src/ui/theme/tokens-theme-light.css
    - src/ui/theme/tokens-theme-dark.css
    - src/ui/hooks/useThemePreference.tsx
    - postcss.config.js
    - vite.config.ts
---

The KAIROS frontend (React app under `src/ui`) uses a design-token-driven styling system built on CSS custom properties and Tailwind CSS v4. The approach is intentionally minimal: no component library, no SCSS preprocessor, no CSS-in-JS runtime. All visual decisions flow from a single source of truth in CSS variables, which are then mapped into Tailwind's theme for utility-class consumption.

**System overview**
- **CSS tokens**: Semantic design tokens live in `src/ui/theme/tokens.css`, which imports shared structural tokens (`tokens-shared.css` — spacing, typography, radius, layout limits) and two theme variants (`tokens-theme-light.css`, `tokens-theme-dark.css`). New themes are added by creating another `tokens-theme-*.css` file and importing it from `tokens.css`.
- **Tailwind v4 integration**: `index.css` imports `@import "tailwindcss"` and uses the new Tailwind v4 `@theme inline` block to re-export every CSS variable as a Tailwind theme token (e.g. `--color-primary`, `--spacing-4`, `--radius-md`, badge/status tokens). Components therefore style themselves with Tailwind utilities like `bg-surface text-text-primary` rather than raw class names.
- **PostCSS pipeline**: `postcss.config.js` wires `@tailwindcss/postcss` plus `autoprefixer`. Vite consumes this via its default PostCSS integration.
- **Build & serving**: `vite.config.ts` builds the React app from `src/ui` into `dist/ui/` with code-splitting groups for React, TipTap, and vendor chunks. Assets are emitted as external URLs (`assetsInlineLimit: 0`) to satisfy the server's CSP (`img-src 'self'`).

**Theming architecture**
- Theme selection is driven by an HTML attribute `html[data-theme="light|dark"]`, set by the `useThemePreference` hook (`src/ui/hooks/useThemePreference.tsx`). The hook persists user preference in `localStorage` under key `kairos:ui:theme-preference`, supports a `system` mode that mirrors `prefers-color-scheme`, and syncs across tabs via the `storage` event.
- `tokens-theme-light.css` defines semantic color variables on `:root`; `tokens-theme-dark.css` overrides them under `html[data-theme="dark"]`. Shared structural tokens (spacing scale, font sizes, radii, layout max widths) are theme-agnostic and live in `tokens-shared.css`.
- Global accessibility helpers in `index.css`: `.skip-link` (keyboard-only skip navigation), `.sr-only`, and a `prefers-reduced-motion` media query that collapses all animations/transitions.

**Conventions developers should follow**
1. **Never hard-code colors or spacing in components.** Use Tailwind utilities backed by the token layer (`text-text`, `bg-surface`, `p-spacing-4`, `rounded-radius-md`).
2. **Add new tokens only in `src/ui/theme/*.css`.** Structural tokens go in `tokens-shared.css`; theme-specific values go in `tokens-theme-light.css` / `tokens-theme-dark.css`. Then add a mapping line in the `@theme inline` block of `index.css` so Tailwind can consume it.
3. **Do not import theme files directly in components.** Import `index.css` once at the app root (`main.tsx` → `App.tsx` chain) so the token-to-Tailwind bridge is applied globally.
4. **Use the `ThemeProvider` / `useThemePreferenceContext` hook** for any UI that needs to read or change the active theme; do not toggle `data-theme` manually outside the hook.
5. **Keep CSS scoped to tokens and utilities.** Avoid ad-hoc global rules beyond what lives in `index.css` (skip link, sr-only, reduced motion).
6. **When adding a new theme**, create `tokens-theme-<name>.css`, override the same semantic variables as the light/dark variants, and import it from `tokens.css`. Update `UI_THEME_CHOICES` in `useThemePreference.tsx` if you want runtime switching.