# Testing UI at real-world dimensions

The app layout can look “made for one window size” because the main content is constrained to a fixed max width. This doc explains the cause and how to test at different viewport sizes.

## Why it looks wrong at different sizes

- **Layout** (`src/ui/components/Layout.tsx`): `<main>` uses `max-w-[48rem]` (768px) and `mx-auto`, so content is always a narrow column in the center.
- On a **large monitor** the rest of the viewport is empty; on a **small tab** it happens to fill the width, so it looks “right” there and wrong elsewhere.
- Fixing the layout (wider or responsive max-width) is tracked in `.cursor/todos-kairos-ui-ia.md` (todo #3).

## What helps test against real-world dimensions

### 1. Storybook + viewport (recommended for components and screens)

- **Screens stories** (`src/ui/Screens.stories.tsx`) already render the full app shell (Layout + route) at different routes (Home, KAIROS, Account, Protocol detail, Edit, etc.).
- **Viewport addon**: `@storybook/addon-viewport` is installed and registered in `.storybook/main.ts`. Viewport presets are defined in `.storybook/preview.tsx`:
  - **Mobile (375)** — 375×667
  - **Tablet (768)** — 768×1024
  - **Desktop (1280)** — 1280×800 (default)
  - **Wide (1920)** — 1920×1080
- **How to use**: Run `npm run storybook`, open a **Screens** story (e.g. Screens / Home or Kairos), then use the **Viewport** control in the toolbar to switch size and see how the layout behaves at real-world dimensions.

### 2. Browser DevTools (no setup)

- Open the app at `http://localhost:3300/ui/`.
- **Chrome/Edge**: DevTools → Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M) → pick a device or set custom dimensions.
- **Firefox**: DevTools → Responsive Design Mode (Ctrl+Shift+M / Cmd+Opt+M).
- Resize or pick different presets and reload if needed. Good for a quick check at mobile/tablet/desktop.

### 3. Viewport capture script — **agent tool**

- **Script**: `npm run design:viewports` (or `node scripts/capture-viewports.mjs [baseUrl]`).
- **Prereq**: App running at `http://localhost:3300/ui/` (or pass baseUrl).
- **Output**: `.cursor/viewports/{mobile,tablet,desktop,wide}.png` — same breakpoints as Storybook (375×667, 768×1024, 1280×800, 1920×1080).
- **Purpose**: The agent runs this, then reads the images to review layout at real-world dimensions. This is the **canonical agent tool** for design-at-dimensions; screenshots are in the agent workspace (`.cursor/viewports/` is gitignored).

### 4. Cursor browser MCP (agent-driven)

- If the agent has **cursor-ide-browser** MCP, it can open your app URL and take a snapshot at the **current** tab size.
- To test multiple dimensions: resize the browser window (or use DevTools device mode), then ask for another snapshot. The agent cannot change viewport size itself; it sees whatever size the tab is.

## Summary

| Method              | Best for                          | Setup              |
|---------------------|-----------------------------------|--------------------|
| **design:viewports**| **Agent design review** at 4 breakpoints | `npm run design:viewports` (app running) |
| Storybook + viewport| Screens and components at breakpoints | Viewport toolbar in Storybook |
| Browser DevTools    | Quick manual check               | None               |
| Browser MCP         | Agent to “see” current tab       | Current tab size only |

**Agent workflow**: Run `npm run design:viewports` with the app at http://localhost:3300/ui/, then read `.cursor/viewports/*.png` to assess layout at mobile / tablet / desktop / wide.
