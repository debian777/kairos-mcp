# Updates — refresh the CLI and installed skills

Keep both the KAIROS server/CLI and the installed agent skills current.

## Update the server / CLI (npm package)

The npx quick start in [install.md](install.md) always resolves the published
package. To force the latest release explicitly, use the `@latest` tag:

```bash
npx -y @debian777/kairos-mcp@latest serve
```

If you installed the CLI globally, upgrade it with npm:

```bash
npm install -g @debian777/kairos-mcp@latest
kairos --help
```

Pin a specific version by replacing `@latest` with `@<version>` when you need
reproducibility.

## Update the installed skills

The KAIROS agent skills are distributed through the `skills` CLI. Refresh them
with:

```bash
npx skills update
```

To (re)install just the user skill by name:

```bash
npx skills add debian777/kairos-mcp --skill kairos
```

`kairos` is the only user-facing skill. The maintainer skill `kairos-dev` is
developer-scoped (marked internal) and is auto-loaded from a cloned repository;
end users do not install it.

## After updating

- Restart your MCP host so it re-launches `npx ... serve` with the new version.
- If a KAIROS tool misbehaves after an update, capture a report per
  [bug-report.md](bug-report.md).
