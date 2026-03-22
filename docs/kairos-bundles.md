# KAIROS protocol bundles

A **bundle** is a directory tree in Git (or on disk) that holds KAIROS protocol
markdown: many `.md` files, often grouped in subfolders by topic (for example
`jira/`, `gitlab/`, `standardize/`). Bundles are a practical way to version,
review, and share protocols outside the server.

## Layout conventions

- **Subfolders by domain or team** — keeps large collections navigable.
- **One protocol per `.md` file** — each file follows normal mint rules (H1
  title, H2 steps, challenge JSON blocks where required).
- **`README.md` for humans** — optional per-folder or root notes for
  contributors. These are **not** KAIROS protocols; they should not be minted in
  a bulk import.

## Importing a bundle with the CLI

From the bundle root, mint every protocol while skipping `README.md` at any depth:

```bash
kairos mint --force -r /path/to/bundle-root
```

Directory batch mode omits files whose basename is exactly `README.md`. All
other `.md` files are minted in lexicographic path order.

To mint a specific `README.md` as a protocol (unusual), pass that file as the
sole argument:

```bash
kairos mint --force /path/to/some/README.md
```

See [KAIROS CLI](CLI.md) for all `mint` options (`--model`, `--fail-fast`, and
so on).

## Export and API workflows

The [kairos-bundle](../skills/kairos-bundle/SKILL.md) skill drives
`scripts/kairos-bundle.py`: **export** writes protocols from a space to a
directory; **import** mints **top-level** `.md` files in `--dir` only (no
subdirectory recursion). For nested bundle trees, prefer **`kairos mint -r`** as
above. The script supports `--force` and `--dry-run` on import.

## Caveats

- Only the exact name `README.md` is skipped in batch mode (not `Readme.md` or
  `readme.md`).
- If every `.md` under a directory is named `README.md`, batch mint reports
  that there are no files to mint.
