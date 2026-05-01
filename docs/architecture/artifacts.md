# Artifacts architecture

Target repository path:

```text
docs/architecture/artifacts.md
```

This document explains how artifacts work in KAIROS MCP, what is currently
implemented, and the intended near-term direction for artifact slug support.

It deliberately avoids package-directory, zip-bundle, and skill-folder concepts.
The current KAIROS artifact model is simpler:

```text
one adapter/protocol markdown file
+ one or more attached artifact files
```

Example:

```text
Daily-Briefing-Dashboard.md
sort-jira.py
```

The adapter is trained as markdown. The script is trained as an attached
artifact.

## What artifacts are

An artifact is non-markdown content attached to an existing adapter.

Typical artifact examples:

- Python scripts
- shell scripts
- JavaScript files
- Perl scripts
- TOML files
- YAML files
- plain text helper files
- templates

Artifacts are not adapter layers.

| Object | Purpose | URI shape |
|---|---|---|
| Adapter | Protocol / workflow root | `kairos://adapter/{uuid-or-slug}` |
| Layer | Markdown execution step | `kairos://layer/{uuid}` |
| Artifact | Attached script/config/source file | `kairos://artifact/{uuid-or-slug}` |

The current stable runtime principle is:

```text
Protocol markdown defines agent behaviour.
Artifacts are real attached files.
Artifact metadata is minimal.
```

## Current implementation status

Artifacts already exist in the core train/export path, but slug parity is not
complete everywhere yet.

### Implemented today

Current implemented behavior supports artifact storage by using `train` in
non-markdown MIME mode.

If `mime` is omitted or set to `text/markdown`, `train` stores adapter markdown.
If `mime` is non-markdown, `train` treats the input as artifact content.

For artifact mode, these fields are required:

- `content`
- `llm_model_id`
- `mime`
- `artifact_name`
- `adapter_uri`

The current schema describes `content` as protocol markdown for adapters and
script/config source for artifacts, with the format determined by `mime`.

Current allowed artifact MIME types are maintained in the train/store path and
include text/script-like content such as:

- `text/x-python`
- `text/x-shellscript`
- `text/javascript`
- `text/x-perl`
- `text/x-toml`
- `text/yaml`
- `text/plain`

### Current URI limitations

Adapter slug support exists in the runtime URI model, but some artifact-adjacent
schemas still lag behind that model.

Current `kairos-uri.ts` defines both UUID-only and UUID-or-slug adapter URI
regexes:

```text
ADAPTER_UUID_URI_REGEX
ADAPTER_URI_INPUT_REGEX
```

`ADAPTER_URI_INPUT_REGEX` accepts both adapter UUIDs and adapter slugs.

However, current `train_schema.ts` still validates `adapter_uri` and
`source_adapter_uri` using UUID-only adapter URI validation. This means artifact
training against `kairos://adapter/{slug}` may fail schema validation until the
schema is updated.

Current `export_schema.ts` validates artifact URIs as UUID-only:

```text
kairos://artifact/{uuid}
```

Current `export.ts` also detects artifact URIs with a UUID-only regex. Therefore
artifact export by slug is not yet complete on current main.

## Current storage model

Artifact persistence is implemented by `storeArtifact`.

Current storage behavior:

- generates a random artifact memory UUID
- stores the artifact body in `payload.text`
- stores the MIME type in `payload.content_type`
- stores tags including `artifact`
- stores adapter linkage under `payload.adapter.id`
- initializes artifact vectors as zero vectors

Current storage does not yet persist first-class artifact metadata fields such as:

- artifact slug
- artifact version
- artifact SHA-256 hash

Those fields are part of the target design described below.

## Minimal artifact metadata

KAIROS protocols aim to minimize noise for AI agents.

Adapter markdown already has minimal frontmatter, for example:

```markdown
---
slug: daily-briefing-generation-multi-source-work-dashboard
version: 2.2.0
---
```

Artifact files should follow the same low-noise principle.

A Python artifact may carry only:

```python
#!/usr/bin/env python3
# kairos-artifact:
#   slug: sort-jira-py
#   version: 1
```

A shell artifact may carry only:

```bash
#!/usr/bin/env bash
# kairos-artifact:
#   slug: verify-briefing-sh
#   version: 1
```

This metadata is intentionally small.

Do not duplicate adapter metadata inside artifacts. Training links the artifact
to the adapter.

## Artifact slug model

Artifact slug support should mirror adapter slug support.

Target URI examples:

```text
kairos://adapter/daily-briefing-generation-multi-source-work-dashboard
kairos://artifact/sort-jira-py
```

The artifact slug is the stable agent-facing identity.

The UUID remains the storage identity.

```text
artifact slug  -> stable human/agent identity
artifact UUID  -> storage identity
artifact name  -> original/materialized filename
```

For example:

```text
sort-jira-py     -> kairos://artifact/sort-jira-py
sort-jira.py     -> materialized filename
<uuid>           -> Qdrant memory UUID
```

## Target train behavior

Target artifact training flow:

1. Train adapter markdown.
2. Train script/config artifact with non-markdown `mime`.
3. Attach the artifact to the adapter by adapter UUID or adapter slug.
4. Parse optional minimal artifact header.
5. Persist slug, version, and hash in artifact payload.
6. Return both canonical UUID metadata and slug-facing URI where available.

Example input shape:

```json
{
  "content": "#!/usr/bin/env python3\n# kairos-artifact:\n#   slug: sort-jira-py\n#   version: 1\n",
  "llm_model_id": "gpt-5",
  "mime": "text/x-python",
  "artifact_name": "sort-jira.py",
  "adapter_uri": "kairos://adapter/daily-briefing-generation-multi-source-work-dashboard"
}
```

Target output should include enough metadata for agents to use the slug URI:

```json
{
  "uri": "kairos://artifact/sort-jira-py",
  "artifact_uuid": "00000000-0000-0000-0000-000000000000",
  "artifact_uri": "kairos://artifact/00000000-0000-0000-0000-000000000000",
  "artifact_slug": "sort-jira-py",
  "artifact_version": "1",
  "content_type": "text/x-python"
}
```

Exact field names may follow existing output conventions, but the model should
expose both slug and UUID identity.

## Target export behavior

Artifact export should support both slug and UUID forms:

```text
export uri=kairos://artifact/sort-jira-py
export uri=kairos://artifact/{uuid}
```

Both should return the artifact source content.

Adapter source listing should expose attached artifact metadata:

```json
{
  "uri": "kairos://artifact/sort-jira-py",
  "uuid_uri": "kairos://artifact/00000000-0000-0000-0000-000000000000",
  "artifact_uuid": "00000000-0000-0000-0000-000000000000",
  "slug": "sort-jira-py",
  "version": "1",
  "sha256": "...",
  "name": "sort-jira.py",
  "content_type": "text/x-python"
}
```

## Versioning and update detection

Artifacts are independently versioned runtime resources.

This is different from normal application package versioning. For AI/MCP usage,
the goal is to minimize unnecessary changes and avoid refreshing unrelated
files.

Recommended model:

```text
adapter version  -> behaviour contract version
artifact version -> individual file/content version
artifact sha256  -> exact content integrity
```

If only `sort-jira.py` changes, only `sort-jira-py` needs a new artifact version.

Executions should pin the artifact versions they start with. A running execution
must not silently switch to newer artifact versions mid-run.

New activations may use newer artifact versions.

## Runtime dependency rule

KAIROS must not depend on local source-package files at runtime.

Source files are authoring inputs. After training, runtime state is:

```text
trained adapter
+ attached artifacts in KAIROS storage
```

Agents should resolve and export artifacts through KAIROS URIs, not through local
repository paths.

Good:

```text
export kairos://artifact/sort-jira-py
```

Bad:

```text
run ./artifacts/sort-jira.py from the authoring checkout
```

## Execution semantics

Artifacts are attached resources, not standalone adapter runs.

`activate`, `forward`, and `reward` remain adapter execution tools.

Artifacts support adapter execution by providing scripts, configuration, or
templates that the agent can export/materialize and run when a protocol step
requires them.

## HTTP API behavior

The HTTP API reuses the same tool-level train/export schemas and execution
paths.

Expected API surfaces:

- `POST /api/train` for artifact creation through JSON input.
- `POST /api/export` for artifact source retrieval and adapter source listing.

`POST /api/train/raw` is markdown-body oriented and should not be treated as the
primary artifact creation path.

## CLI and UI status

CLI and UI support are still secondary compared to MCP/API behavior.

Known gaps to keep visible:

- dedicated CLI artifact upload flags are not complete
- CLI export format lists may not expose `source` everywhere
- UI protocol pages do not yet provide a complete artifact management workflow
- artifact slug/version/hash display needs to be added after storage support is complete

## Implementation gaps to close

To complete artifact slug parity:

1. Update shared URI parsing/types so `kairos://artifact/{slug}` is accepted.
2. Update train schemas so `adapter_uri` accepts adapter slug or UUID.
3. Update export schemas so artifact URIs accept slug or UUID.
4. Parse minimal artifact metadata from top comments:
   - `slug`
   - `version`
5. Store artifact metadata:
   - `artifact.slug`
   - `artifact.version`
   - `artifact.sha256`
   - original `artifact_name`
6. Resolve adapter slugs during artifact train.
7. Resolve artifact slugs during artifact export.
8. Include artifact slug/version/hash in adapter source listing.
9. Add integration tests for:
   - train artifact attached to adapter slug
   - export artifact by slug
   - export artifact by UUID
   - list artifacts from adapter
   - duplicate artifact slug behavior

## Design constraints

Keep the model small.

Do not introduce package folders, zip files, manifests, or skill-bundle runtime
dependencies as part of artifact slug parity.

The preferred minimum is:

```text
Daily-Briefing-Dashboard.md
sort-jira.py
```

with:

```python
# kairos-artifact:
#   slug: sort-jira-py
#   version: 1
```

## Summary

KAIROS artifacts are real files attached to adapters.

The near-term architecture should make artifacts slug-addressable and
version-aware while preserving UUID compatibility and keeping metadata minimal.

The target model is:

```text
adapter markdown frontmatter -> adapter slug/version
script top comments          -> artifact slug/version
KAIROS storage               -> UUID, content, MIME, adapter link, hash
export                       -> source by artifact slug or UUID
```
