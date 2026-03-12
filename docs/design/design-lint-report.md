# Design-lint report — KAIROS public UI

Validated against the **kairos-ui-designer** skill (§3–§4, §6) and the **award rubric** ([award-rubric-ux-design-awards.md](award-rubric-ux-design-awards.md)). Report format per skill §11.

## Scope

- **App:** `src/ui/` — Layout, HomePage, KairosPage, AccountPage, ProtocolDetailPage, ProtocolEditPage, RunGuidedPage, RunsPage, NotFoundPage, ErrorAlert, CopyButton, SearchResultsSkeleton; `theme/tokens.css`, `index.css`; `index.html`.
- **Mockups:** Storybook export + `Screens.stories.tsx` (1:1 with app).

## Violations (previous audit) — all fixed

| Guideline | Issue | Fix applied |
|-----------|--------|-------------|
| **§4 — Touch targets** | Sidebar logo 40×40px. | Layout: logo wrapped in NavLink with `min-h-[44px] min-w-[44px]` so clickable area ≥ 44px. |
| **§4 — Focus** | Nav links `outline-offset-[-2px]`. | Layout: `outline-offset-2` on nav link class. |
| **§4 — Typography (links)** | In-text links without underline. | ProtocolDetailPage: docs link and error “Go to Home” use `underline`; button-styled links remain `no-underline`. |
| **§4 — Component states (hover)** | Primary CTAs no hover. | Primary buttons/links use `hover:bg-[var(--color-primary-hover)]` (KairosPage, ProtocolDetailPage, ProtocolEditPage, RunGuidedPage, RunsPage, ErrorAlert, AccountPage Sign in). |
| **§4 — Component states (focus)** | AccountPage Sign in: no focus-visible/hover. | AccountPage: Sign in link has `focus-visible:outline …` and `hover:bg-[var(--color-primary-hover)]`. |
| **§4 — Focus (inputs)** | HomePage search used `focus:`. | HomePage and KairosPage search inputs use `focus-visible:outline …`. |

## Checks performed

- **Focus:** Global `:focus-visible` in `tokens.css`; interactive elements have explicit or inherited focus (2px outline, offset 2px). Skip link uses `:focus-visible` so it appears on keyboard only.
- **Labels:** All search and form inputs have `<label htmlFor="…">` and `aria-describedby` where needed. No placeholder-only labels.
- **Errors:** ErrorAlert and protocol/run error blocks use `role="alert"`. Message and retry/go back available. Live regions used for search results and run status.
- **Language:** `index.html` has `lang="en"`.
- **Contrast:** Design tokens for text and UI; role badges use background + text (not colour alone).
- **Semantics:** `<main id="main">`, `<nav aria-label="Main navigation">`, sections with `aria-labelledby`; skip link at start.
- **Touch:** Buttons and nav links use `min-h-[44px]` / `min-w-[44px]`; logo link meets 44×44px.
- **Reduced motion:** `index.css` includes `@media (prefers-reduced-motion: reduce)` to shorten animations and transitions.
- **Screen reader:** `.sr-only` utility and `aria-live="polite"` / `role="status"` on dynamic content (search results summary, run progress, server message).

## Result

**No outstanding violations.** All previously listed violations have been fixed. The UI meets the design-lint bar for the kairos-ui-designer skill and the global acceptance criteria in the award rubric (§5).
