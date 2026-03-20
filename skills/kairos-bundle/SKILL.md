---
name: kairos-bundle
description: "Bundles KAIROS protocols to or from a directory (export: save all protocols as .md files; import: mint all .md files into KAIROS personal space). Uses KAIROS API with KAIROS_TOKEN. Use when the user wants to backup, restore, bundle, or bulk export/import KAIROS protocols, or sync protocols to/from a folder."
---

# kairos-bundle

Export all KAIROS protocols to a directory of `.md` files, or import all `.md` files from a directory into KAIROS (personal space).

## Prerequisites

- **Python 3** — Interpreter to run the script.
- **KAIROS CLI** — For obtaining a token (`kairos token`); must be on `PATH`.
- **KAIROS MCP** — Server running and reachable (e.g. `KAIROS_API_URL` or default `http://localhost:3000`).
- **KAIROS_TOKEN** — Bearer token (e.g. `KAIROS_TOKEN=$(kairos token)`).
- **KAIROS_API_URL** — Optional; default `http://localhost:3000`.

## Run the script

From the **skill directory** (the directory that contains this `SKILL.md` — e.g. `skills/kairos-bundle` in the repo or `~/.agents/skills/kairos-bundle` when installed):

```bash
# Export: save all protocols from spaces into --dir
KAIROS_TOKEN=$(kairos token) python3 scripts/kairos-bundle.py export [--dir DIR]

# Import: mint all .md files from --dir into KAIROS (personal space)
KAIROS_TOKEN=$(kairos token) python3 scripts/kairos-bundle.py import [--dir DIR]
```

So the script path is always `scripts/kairos-bundle.py` relative to the skill directory; the agent should run these commands with the current working directory set to the skill directory.

**Do not confuse:** the **skill directory** (cwd when running) is where the skill and script live. The **`--dir`** option is the **bundle directory** — where `.md` files are written (export) or read from (import); it is independent of the skill directory.

**Critical — always use an absolute path for `--dir` when the user means a project path.** The script is run with cwd = skill directory (so `scripts/kairos-bundle.py` is found). Any relative path passed to `--dir` is then resolved relative to that cwd (e.g. `~/.agents/skills/kairos-bundle` when the skill is installed there). So if the user says e.g. "export to kairos/bundles/trunk", they mean relative to the **workspace/project root**, not the skill directory. The agent must resolve that path against the workspace root and pass the **absolute path** to `--dir` (e.g. `--dir /path/to/project/kairos/bundles/trunk` or `--dir "$(pwd)/kairos/bundles/trunk"` when the shell is already in the project root). Otherwise files will be written under the skill directory or `~/.agents`, which is wrong.

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

When the bundle directory is inside the user's project, use an absolute path (resolve from workspace root):

```bash
# From project root; BUNDLE_DIR is absolute so it doesn't depend on skill cwd
cd /path/to/project
KAIROS_TOKEN=$(kairos token) python3 /path/to/skill/scripts/kairos-bundle.py export --dir "$(pwd)/kairos/bundles/trunk" --space "Personal"
KAIROS_TOKEN=$(kairos token) python3 /path/to/skill/scripts/kairos-bundle.py import --dir "$(pwd)/kairos/bundles/trunk" --force
```

Or call from the skill directory and pass an absolute bundle path:

```bash
cd ~/.agents/skills/kairos-bundle   # or skills/kairos-bundle in repo
KAIROS_TOKEN=$(kairos token) python3 scripts/kairos-bundle.py export --dir /path/to/project/kairos/bundles/trunk
```
