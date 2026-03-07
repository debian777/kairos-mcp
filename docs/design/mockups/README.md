# Mockups

Browser canvas (HTML) mockups for the KAIROS public UI. Same screens in two themes.

| Folder | Theme | Use |
|--------|--------|-----|
| [default/](default/) | Teal primary (`#0d9488`), warm neutrals | Legacy HTML mockups (reference) |
| [static/](static/) | — | **1:1 Storybook export.** Same as app. Generate with `npm run storybook:export-mockups`. Open `index.html`. |
| [it-pro/](it-pro/) | Navy blue primary (`#1e40af`), cooler neutrals | IT business & professionals |
| [it-pro-2/](it-pro-2/) | Soft blue primary (`#7096D1`), same neutrals as it-pro | IT business (lighter variant) |

**default/** screens: 01-home-search, 03-protocol-detail, 04-error-recovery, 05-account, 06-protocol-create-edit, 07-kairos-actions. Links between pages are relative within the same folder.

**Source of truth for 1:1:** React components and Storybook stories in `src/ui/`. Run `npm run storybook` for dev or `npm run storybook:export-mockups` to refresh `static/`.

When the app supports theme switching, the UI will apply one of these token sets via CSS custom properties.
