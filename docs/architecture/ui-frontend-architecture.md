# UI frontend architecture

This document describes the current KAIROS UI frontend as it exists in
the repository today. It keeps implementation details under
`docs/architecture/` and separates them from design guidance in
`docs/design/`.

## Overview

The UI is a React single-page application that is built with Vite and
served from the same Express process as the MCP and REST APIs. This
keeps authentication, cookies, and API calls on the same origin while
still preserving a clear frontend boundary in `src/ui/`.

The current stack is:

- React 19
- React Router with `BrowserRouter` and `basename="/ui"`
- TanStack Query for server state
- `react-i18next` for translations
- CSS design tokens in `src/ui/theme/tokens.css`
- Tailwind utility classes in UI components
- Storybook for component and screen review

## Runtime boundary

The server owns delivery of the frontend bundle. `setupUiStatic()` in
`src/http/http-ui-static.ts` redirects `/` to `/ui`, serves static files
from the built UI directory, and falls back to `index.html` for
unmatched `/ui` routes.

The frontend talks to the backend over same-origin requests. `apiFetch()`
in `src/ui/lib/api.ts` sends requests to `/api/*` with
`credentials: "same-origin"`, which keeps the browser session model
simple and avoids a separate frontend gateway.

## App structure

The UI code lives under `src/ui/`. The top-level layout is stable and
the routing tree is small enough to remain easy to reason about.

### Entry points

`src/ui/main.tsx` bootstraps React and provides a shared TanStack Query
client. `src/ui/App.tsx` owns the route tree and mounts the app under
`/ui`.

### Route map

The current route set is:

- `/` for `HomePage`
- `/kairos` for protocol discovery
- `/runs` for saved browser test runs
- `/protocols/new` for protocol creation
- `/protocols/:uri` for protocol detail
- `/protocols/:uri/edit` for protocol editing
- `/protocols/:uri/run` for guided test execution
- `/protocols/:uri/skill` for skill-bundle export guidance
- `/account` for session identity details

`Layout` wraps all routed pages so navigation, branding, and page shell
stay consistent.

### Data access

The UI keeps server interactions in hooks rather than inside page
components. Current hooks cover auth, protocol search and fetch, spaces,
and the guided run flow (`kairos_begin`, `kairos_next`,
`kairos_attest`).

This split keeps pages focused on user flow and lets TanStack Query own
loading, error, and cache state.

## Editing and run flows

The frontend currently supports two implementation-heavy flows that are
worth calling out explicitly.

### Protocol editing

`ProtocolEditPage` is a markdown-first editor with upload, validation,
preview, and save behavior. New protocols are created through
`/api/kairos_mint/raw`, while edits go through `/api/kairos_update`.

The editor validates for an H1 title plus the required `Natural language
triggers` and `Completion rule` sections before submission.

### Guided test runs

`RunGuidedPage` starts a run with `kairos_begin`, advances steps with
`kairos_next`, and finishes with `kairos_attest`. Browser-side session
state is persisted through the run-session hooks so a user can resume a
manual test run on the same device.

This is a test and validation surface for humans. It does not replace
the agent-first execution model documented elsewhere in this section.

## Design system and Storybook

Design tokens live in `src/ui/theme/tokens.css`, which defines colors,
spacing, typography, radius, and global focus-visible behavior. The
implementation uses those tokens directly inside Tailwind class strings.

Storybook is the canonical review surface for component and screen work.
It is used for:

- screen stories that reflect the implemented app
- target-design stories such as `ProtocolUXMockups.stories.tsx`
- local design review without maintaining a second exported docs site

There is no longer a generated `docs/design/mockups/` export. Design
reference stays in Storybook, while durable written guidance stays in
`docs/design/`.

## Why this architecture stays

This setup remains the right fit for the current product because it:

- keeps auth and API traffic same-origin
- preserves a clean separation between backend code and frontend code
- supports interactive flows that are awkward in server-rendered HTML
- works well with the existing React-based Storybook and design process

The main tradeoff is the frontend build step, but that is already part
of the normal application build and is lower risk than maintaining a
separate UI stack or a duplicated static mockup export path.

## Next steps

If the route tree or frontend boundary changes, update this page together with
the relevant docs in `docs/design/` so product-facing design guidance and
implementation-facing architecture notes stay separated.
