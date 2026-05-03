# mime-artifact-sample

Fixture adapter for integration tests: one **non-markdown** artifact per allowed `content_type` (`train-store` allowlist), plus valid adapter Markdown.

Layout (skill root = this directory):

| Path | Purpose |
| --- | --- |
| `SKILL.md` | Train with `POST /api/train/raw` (or MCP **`train`**) — adapter Markdown. |
| `notes.txt` | Source for the **`text/plain`** artifact (upload body). |
| `conf/app-config.toml`, `conf/routes.yaml` | Config artifacts (`text/x-toml`, `text/yaml`). |
| `scripts/hello.*` | Runnable scripts (`text/x-python`, `text/x-shellscript`, `text/javascript`, `text/x-perl`). |

`SKILL.md` uses **four** `shell` proof-of-work layers (one per `hello.*`), each with its own **`interpreter`** / **`flags`** / **`args`** / **`cmd`** / **`timeout_seconds`** — no `grep`; exit code only.

Attach non-markdown files via `POST /api/train` JSON (or MCP **`train`**) with `mime`, `artifact_name`, `adapter_uri`, and `content` read from the paths above.

Set `KAIROS_MIME_SAMPLE_ROOT` to the absolute path of this directory when running scripts from another cwd; otherwise run from the skill root.

| Source file | `mime` for `POST /api/train` |
| --- | --- |
| `scripts/hello.py` | `text/x-python` |
| `scripts/hello.sh` | `text/x-shellscript` |
| `scripts/hello.cjs` | `text/javascript` |
| `scripts/hello.pl` | `text/x-perl` |
| `conf/app-config.toml` | `text/x-toml` |
| `conf/routes.yaml` | `text/yaml` |
| `notes.txt` | `text/plain` |
