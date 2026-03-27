# Claude Desktop — skills (.zip)

MCP config file paths and a KAIROS `mcpServers` example: **[../README.md](../README.md)**.

Claude Desktop can import skills as **`.zip`** archives (see Anthropic’s skills
docs for the current UI path). This repo builds **one zip per skill** from
`skills/` in CI and attaches them to each **GitHub Release** alongside the npm
SBOM.

## Release assets

After a version tag build, download from the release page (replace `TAG` and
check exact filenames on the release):

- `https://github.com/debian777/kairos-mcp/releases/download/TAG/kairos-claude-desktop-<semver>.zip`
- `https://github.com/debian777/kairos-mcp/releases/download/TAG/kairos-bug-report-claude-desktop-<semver>.zip`
- `https://github.com/debian777/kairos-mcp/releases/download/TAG/kairos-install-claude-desktop-<semver>.zip`

`<semver>` matches the release tag without the leading `v` (e.g. tag `v3.2.1`
→ `3.2.1`).

## Local build

From the repository root (needs `/usr/bin/zip`, macOS/Linux):

```bash
chmod +x scripts/package-claude-desktop-skills.sh
scripts/package-claude-desktop-skills.sh "$(node -p "require('./package.json').version")"
```

Output directory: `dist/claude-desktop-skills/` (gitignored).

## Maintenance

Packaging is implemented in **`scripts/package-claude-desktop-skills.sh`** and
invoked from **`.github/workflows/release.yml`** (`claude-desktop-skills` job).
Add a new skill directory there when you add a publishable skill under
`skills/` or `skills/.system/`.
