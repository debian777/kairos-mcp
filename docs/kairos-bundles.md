# KAIROS protocol bundles

A bundle is a directory of protocol markdown files stored outside the KAIROS
server, usually in Git. Bundles are useful when you want reviewable source
files for protocols, export snapshots from a space, or bulk-import a set of
documents.

## Bundle layout

Recommended layout:

- one protocol per `.md` file
- optional subdirectories by topic or team
- optional `README.md` files for humans

Every protocol file still has to satisfy the normal mint rules enforced by the
server:

- H1 title
- `## Natural Language Triggers` as the first H2
- `## Completion Rule` as the last H2
- at least one trailing ````json` challenge block somewhere in the file

## Bulk import with the CLI

The CLI can mint a whole directory.

### Top-level only

```bash
kairos mint --force /path/to/bundle-root
```

This imports only `.md` files directly inside the bundle root.

### Recursive import

```bash
kairos mint --force --recursive /path/to/bundle-root
```

This imports `.md` files from subdirectories too.

### `README.md` handling

In directory-batch mode, the CLI skips files whose basename is exactly
`README.md`. That rule applies at the root and in subdirectories. If you really
want to mint a `README.md` file, pass that file path explicitly instead of a
directory.

## Export/import with the `kairos-bundle` skill script

The repo also ships `skills/kairos-bundle/scripts/kairos-bundle.py`.

That script uses:

- `KAIROS_TOKEN` for Bearer auth
- optional `KAIROS_API_URL` (defaults to `http://localhost:3000`)

### Export

`export`:

- calls `/api/kairos_spaces`
- optionally filters by one human-readable space name
- dumps each chain with `protocol: true`
- writes one `.md` file per exported protocol into `--dir`

### Import

`import`:

- reads `.md` files from `--dir`
- mints them through `/api/kairos_mint/raw`
- supports `--force`
- does **not** recurse into subdirectories

For nested directory trees, prefer the CLI’s `kairos mint --recursive`.

## Practical guidance

- Use the **CLI** when your bundle is already a nested directory tree and you
  want recursive import.
- Use the **bundle script/skill** when you want a simple export/import workflow
  built around Bearer auth and a single bundle directory.

## Caveats

- Only the exact basename `README.md` is skipped in CLI directory-batch mode.
- The bundle script import path is non-recursive.
- Exported filenames from the bundle script are generated from protocol title +
  chain ID prefix, so they may not match your original source tree layout.
