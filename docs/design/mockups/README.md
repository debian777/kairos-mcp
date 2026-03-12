# Mockups

| Folder | Use |
|--------|-----|
| [static/](static/) | **1:1 Storybook export.** Same as app. Generate with `npm run storybook:export-mockups`. Open `index.html`. |

**Source of truth:** React components and Storybook stories in `src/ui/`. Run `npm run storybook` for dev or `npm run storybook:export-mockups` to refresh `static/`.

**Protocol UX (Target):** The stories under **Mockups / Protocol UX (Target)** in Storybook are the design reference for the next implementation phase (step flow graph, challenge cards, Markdown-rendered content, editor layout, upload/download). Implement from those mockups. The edit mock shows a toolbar + text area as a placeholder; the real implementation can use an open-source Markdown editor (e.g. [@uiw/react-md-editor](https://github.com/uiwjs/react-md-editor)) for rich editing.

Theme variants (it-pro, it-pro-2) and palette reference: [theme-colors.md](../theme-colors.md). When the app supports theme switching, the UI will apply one of those token sets via CSS custom properties.
