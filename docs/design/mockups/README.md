# Mockups

| Folder | Use |
|--------|-----|
| [static/](static/) | **1:1 Storybook export.** Same as app. Generate with `npm run storybook:export-mockups`. Open `index.html`. |

**Source of truth:** React components and Storybook stories in `src/ui/`. Run `npm run storybook` for dev or `npm run storybook:export-mockups` to refresh `static/`.

Theme variants (it-pro, it-pro-2) and palette reference: [theme-colors.md](../theme-colors.md). When the app supports theme switching, the UI will apply one of those token sets via CSS custom properties.
