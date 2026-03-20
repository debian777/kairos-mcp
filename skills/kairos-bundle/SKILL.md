---
name: kairos-bundle
description: "Bundles KAIROS protocols to or from a directory (export: save all protocols as .md files; import: mint all .md files into KAIROS personal space). Uses KAIROS API with KAIROS_TOKEN. Use when the user wants to backup, restore, bundle, or bulk export/import KAIROS protocols, or sync protocols to/from a folder."
---

# kairos-bundle

Export all KAIROS protocols to a directory of `.md` files, or import all `.md` files from a directory into KAIROS (personal space).

## Prerequisites

- **KAIROS_TOKEN** — Bearer token (e.g. `KAIROS_TOKEN=$(kairos token)`).
- **KAIROS_API_URL** — Optional; default `http://localhost:3000`.

## Run the script

From the **repo root**:

```bash
# Export: save all protocols from spaces into --dir
KAIROS_TOKEN=$(kairos token) python3 skills/kairos-bundle/scripts/kairos-bundle.py export [--dir DIR]

# Import: mint all .md files from --dir into KAIROS (personal space)
KAIROS_TOKEN=$(kairos token) python3 skills/kairos-bundle/scripts/kairos-bundle.py import [--dir DIR]
```

## Options

| Action   | Option   | Description |
|----------|----------|-------------|
| export   | `--dir`  | Target directory to write .md files (default: `.local/cache/dump`) |
| export   | `--space`| Only export chains from this space (e.g. `Personal`) |
| export   | `--dry-run` | List chains only, do not save |
| import   | `--dir`  | Target directory to read .md files from (default: `.local/cache/dump`) |
| import   | `--force`| Overwrite existing chain with same title |
| import   | `--dry-run` | List .md files only, do not mint |

## Examples

```bash
KAIROS_TOKEN=$(kairos token) python3 skills/kairos-bundle/scripts/kairos-bundle.py export --dir ./protocols --space "Personal"
KAIROS_TOKEN=$(kairos token) python3 skills/kairos-bundle/scripts/kairos-bundle.py import --dir ./protocols --force
```
