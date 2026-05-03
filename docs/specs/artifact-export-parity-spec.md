# artifact export parity spec

This spec defines the end-to-end artifact train and export parity contract for
the fixture at `tests/test-data/mime-artifact-sample`.

The objective is deterministic byte behavior across transports while preserving
strict transport isolation in tests.

## scope and transports

The parity contract covers three transport families:

- API transport: `/api/train`, `/api/train/raw`, `/api/export`,
  `/api/delete`, and `download_ref` retrieval.
- MCP transport: `train`, `export`, and `delete` via MCP `callTool`.
- CLI transport: `kairos export` and `kairos delete`.

CLI cannot ingest non-markdown artifacts today, so CLI coverage is export-only.
The CLI test pre-trains fixture data via API in `beforeAll`.

## stage model

The test flow has three stages for API and MCP, and one stage for CLI.

1. Stage 0: train fixture bytes from disk and export bundle `B0`.
2. Stage 1: cleanup stage-0 adapter data, train from `B0`, export `B1`.
3. Stage 2: cleanup stage-1 adapter data, train from `B1`, export `B2`.

CLI runs Stage 0 only because CLI train currently supports markdown files only.

## acceptance criteria by stage

Stage 0 acceptance criteria:

- The seven artifact rows in `<slug>/SHA256SUMS` must match the fixture
  `SHA256SUMS` rows for those same paths.
- The bundle must self-verify (`shasum -a 256 -c` equivalent).
- The `SKILL.md` row is informational only at Stage 0 and is not asserted.

Stage 1 acceptance criteria:

- `B1` `<slug>/SHA256SUMS` body is byte-identical to `B0` body, including file
  order and trailing newline.
- Byte identity includes every row, including `SKILL.md`.
- The bundle self-verifies.

Stage 2 acceptance criteria:

- `B2` `<slug>/SHA256SUMS` body is byte-identical to `B1`.
- The bundle self-verifies.

## per-format assertions

The test assertions are format-specific.

- `skill_tree`: assert paths from `skills[].files[].path`.
- `skill_zip`: assert `skill_bundle_manifest.artifacts` includes all exported
  non-`SKILL.md`, non-`SHA256SUMS` files.

The implementation in `src/tools/export.ts` excludes only `SKILL.md` and
`SHA256SUMS` from the ZIP manifest artifacts array.

## fixture byte contract

Fixture bytes are a train-input contract.

- Files in `tests/test-data/mime-artifact-sample` must be normalized so train
  stores exactly those bytes for artifact payloads.
- Artifact fixture files must not contain trailing whitespace or trailing new
  lines.
- `SHA256SUMS` is generated using bytewise path ordering to match export code.

## cleanup contract

Each test must clean up Stage N adapter data before training Stage N+1.

- API tests use API delete endpoints only.
- MCP tests use MCP delete tool only.
- CLI tests use CLI delete command only.

Cleanup must remove the stage adapter and related artifact memories to avoid
artifact slug collisions in subsequent stages.

## coverage matrix

The fixture and tests cover one markdown adapter plus seven artifact MIME types:

- `SKILL.md` -> `text/markdown`
- `scripts/hello.py` -> `text/x-python`
- `scripts/hello.sh` -> `text/x-shellscript`
- `scripts/hello.cjs` -> `text/javascript`
- `scripts/hello.pl` -> `text/x-perl`
- `conf/app-config.toml` -> `text/x-toml`
- `conf/routes.yaml` -> `text/yaml`
- `notes.txt` -> `text/plain`
