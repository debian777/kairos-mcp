# Training Commands

<cite>
**Referenced Files in This Document**
- [cli-train.ts](file://src/cli/commands/cli-train.ts)
- [train.ts](file://src/tools/train.ts)
- [train-store.ts](file://src/tools/train-store.ts)
- [train_schema.ts](file://src/tools/train_schema.ts)
- [train-mime.ts](file://src/tools/train-mime.ts)
- [train-artifact-adapter-uri.ts](file://src/tools/train-artifact-adapter-uri.ts)
- [train-output-adapter-uri.ts](file://src/tools/train-output-adapter-uri.ts)
- [artifact-mime.ts](file://src/tools/artifact-mime.ts)
- [artifact-files.ts](file://src/tools/skill-export/artifact-files.ts)
- [artifact-catalog.ts](file://src/tools/artifact-catalog.ts)
- [artifact-relative-path.ts](file://src/tools/artifact-relative-path.ts)
- [kairos-local-artifact-dirs.ts](file://src/utils/kairos-local-artifact-dirs.ts)
- [validate-protocol-structure.ts](file://src/services/memory/validate-protocol-structure.ts)
- [frontmatter.ts](file://src/utils/frontmatter.ts)
- [extension-mime-map.ts](file://src/tools/skill-export/artifact-sanitization/extension-mime-map.ts)
- [upload-guards.ts](file://src/cli/upload-guards.ts)
- [kairos-uri.ts](file://src/tools/kairos-uri.ts)
- [qdrant-service.ts](file://src/services/qdrant/service.ts)
- [memory-store.ts](file://src/services/memory/store.ts)
- [http-api-train-json.ts](file://src/http/http-api-train-json.ts)
- [http-api-train-raw.ts](file://src/http/http-api-train-raw.ts)
- [cli-commands-shared.ts](file://tests/integration/cli-commands-shared.ts)
- [cli-train-batch.test.ts](file://tests/integration/cli-train-batch.test.ts)
- [http-api-train-json.test.ts](file://tests/integration/http-api-train-json.test.ts)
- [http-api-train-similarity-guard.test.ts](file://tests/integration/http-api-train-similarity-guard.test.ts)
- [http-api-train-space-errors.test.ts](file://tests/integration/http-api-train-space-errors.test.ts)
- [kairos-train-basic.test.ts](file://tests/integration/kairos-train-basic.test.ts)
- [kairos-train-artifact.test.ts](file://tests/integration/kairos-train-artifact.test.ts)
- [kairos-train-validation.test.ts](file://tests/integration/kairos-train-validation.test.ts)
- [kairos-train-import-data.test.ts](file://tests/integration/kairos-train-import-data.test.ts)
- [kairos-train-integration.test.ts](file://tests/integration/kairos-train-integration.test.ts)
- [kairos-train-access.test.ts](file://tests/integration/kairos-train-access.test.ts)
- [kairos-train-edge-cases.test.ts](file://tests/integration/kairos-train-edge-cases.test.ts)
- [kairos-train-docs-examples.test.ts](file://tests/integration/kairos-train-docs-examples.test.ts)
- [kairos-train-ai-coding-rules.test.ts](file://tests/integration/kairos-train-ai-coding-rules.test.ts)
- [kairos-train-heading-sanitization.test.ts](file://tests/integration/kairos-train-heading-sanitization.test.ts)
- [train-mime.test.ts](file://tests/unit/train-mime.test.ts)
- [train-schema-fork.test.ts](file://tests/unit/train-schema-fork.test.ts)
- [train-schema-relative-path.test.ts](file://tests/unit/train-schema-relative-path.test.ts)
- [train-similarity-query.test.ts](file://tests/unit/train-similarity-query.test.ts)
- [train-similarity-guard.test.ts](file://tests/unit/train-similarity-guard.test.ts)
- [train-artifact-adapter-uri.test.ts](file://tests/unit/train-artifact-adapter-uri.test.ts)
- [train-artifact-mime-inference.test.ts](file://tests/unit/train-artifact-mime-inference.test.ts)
</cite>

## Update Summary
**Changes Made**
- Enhanced CLI train command documentation with automatic artifact discovery and upload capabilities
- Added comprehensive coverage of batch training features including co-located artifact detection
- Updated artifact MIME configuration section with automatic inference and structured error reporting
- Expanded troubleshooting guide with artifact upload error scenarios
- Added new section on automatic artifact discovery during batch training operations

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the KAIROS MCP training commands that enable registering adapters from protocol markdown and attaching artifacts to adapters. It covers:
- The train command for single files and directory batches with automatic artifact discovery
- Protocol markdown syntax and validation rules
- Artifact attachment, MIME inference, and relative path handling
- Local artifact directory configuration and environment variables
- Embedding configuration and quality assurance checks
- Batch processing, error handling, and performance optimization
- Integration with external data sources and validation pipelines

**Updated** Enhanced with automatic discovery and uploading of co-located artifact files during batch training operations, comprehensive MIME inference capabilities, and structured error reporting for skipped artifacts.

## Project Structure
The training subsystem spans CLI, HTTP APIs, tools, services, and validation utilities:
- CLI command implementation and batch orchestration with artifact discovery
- Tool registration and input/output schemas
- Store-level persistence for adapters and artifacts
- Validation of protocol structure and size limits
- MIME allowlists and inference for artifacts
- Local artifact directory configuration and environment variables
- Qdrant-backed adapter lookup and URI resolution

```mermaid
graph TB
CLI["CLI train command<br/>src/cli/commands/cli-train.ts"] --> HTTP["HTTP train routes<br/>src/http/*train*.ts"]
CLI --> Tool["MCP tool 'train'<br/>src/tools/train.ts"]
Tool --> Store["executeTrainStore<br/>src/tools/train-store.ts"]
Store --> Mem["Memory store<br/>src/services/memory/store.ts"]
Store --> Qdr["Qdrant service<br/>src/services/qdrant/service.ts"]
Tool --> Schema["Zod schemas<br/>src/tools/train_schema.ts"]
Tool --> Mime["MIME resolution<br/>src/tools/train-mime.ts"]
Tool --> OutURI["Output adapter URI resolver<br/>src/tools/train-output-adapter-uri.ts"]
Store --> Proto["Protocol validator<br/>src/services/memory/validate-protocol-structure.ts"]
Store --> FM["Frontmatter parser<br/>src/utils/frontmatter.ts"]
Mime --> AMime["Artifact MIME allowlist<br/>src/tools/artifact-mime.ts"]
AMime --> ExtMap["Extension–MIME map<br/>src/tools/skill-export/artifact-sanitization/extension-mime-map.ts"]
CLI --> ArtFiles["Artifact discovery<br/>src/tools/skill-export/artifact-files.ts"]
CLI --> LocalDirs["Local artifact dirs<br/>src/utils/kairos-local-artifact-dirs.ts"]
```

**Diagram sources**
- [cli-train.ts:56-276](file://src/cli/commands/cli-train.ts#L56-L276)
- [train.ts:240-346](file://src/tools/train.ts#L240-L346)
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [train_schema.ts:54-168](file://src/tools/train_schema.ts#L54-L168)
- [train-mime.ts:4-22](file://src/tools/train-mime.ts#L4-L22)
- [train-output-adapter-uri.ts:4-33](file://src/tools/train-output-adapter-uri.ts#L4-L33)
- [validate-protocol-structure.ts:113-187](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [frontmatter.ts:23-54](file://src/utils/frontmatter.ts#L23-L54)
- [artifact-mime.ts:34-50](file://src/tools/artifact-mime.ts#L34-L50)
- [extension-mime-map.ts:10-27](file://src/tools/skill-export/artifact-sanitization/extension-mime-map.ts#L10-L27)
- [artifact-files.ts:30-87](file://src/tools/skill-export/artifact-files.ts#L30-L87)
- [kairos-local-artifact-dirs.ts:10-40](file://src/utils/kairos-local-artifact-dirs.ts#L10-L40)
- [http-api-train-json.ts](file://src/http/http-api-train-json.ts)
- [http-api-train-raw.ts](file://src/http/http-api-train-raw.ts)
- [memory-store.ts](file://src/services/memory/store.ts)
- [qdrant-service.ts](file://src/services/qdrant/service.ts)

**Section sources**
- [cli-train.ts:56-276](file://src/cli/commands/cli-train.ts#L56-L276)
- [train.ts:240-346](file://src/tools/train.ts#L240-L346)
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [train_schema.ts:54-168](file://src/tools/train_schema.ts#L54-L168)

## Core Components
- CLI train command: supports single-file and directory batch modes, artifact mode detection, automatic co-located artifact discovery, and sensitive content guards.
- MCP tool 'train': validates inputs, resolves content (including forking from another adapter), and persists to memory/Qdrant.
- Store-level persistence: validates protocol structure and sizes, stores adapters or artifacts, and normalizes relative paths for exports.
- Protocol validation: enforces required sections and contract blocks.
- MIME handling: allowlist, normalization, and inference from filenames.
- Local artifact directory configuration: environment-based directory hints for artifact management.
- Adapter URI resolution: canonicalizes adapter URIs for artifacts and constructs output adapter URIs.

**Updated** Enhanced CLI train command now includes automatic discovery and uploading of co-located artifact files during batch training operations with structured error reporting.

**Section sources**
- [cli-train.ts:56-276](file://src/cli/commands/cli-train.ts#L56-L276)
- [train.ts:134-238](file://src/tools/train.ts#L134-L238)
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [validate-protocol-structure.ts:113-187](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [artifact-mime.ts:34-50](file://src/tools/artifact-mime.ts#L34-L50)
- [train-mime.ts:4-22](file://src/tools/train-mime.ts#L4-L22)
- [train-artifact-adapter-uri.ts:5-37](file://src/tools/train-artifact-adapter-uri.ts#L5-L37)
- [train-output-adapter-uri.ts:4-33](file://src/tools/train-output-adapter-uri.ts#L4-L33)
- [kairos-local-artifact-dirs.ts:10-40](file://src/utils/kairos-local-artifact-dirs.ts#L10-L40)

## Architecture Overview
The training pipeline accepts either raw markdown or artifact content, validates inputs, resolves content (including forking), and persists to memory/Qdrant. The MCP tool integrates with space scoping and error formatting. The enhanced CLI now automatically discovers and uploads co-located artifact files during batch training operations with structured error reporting.

```mermaid
sequenceDiagram
participant User as "User"
participant CLI as "CLI train<br/>cli-train.ts"
participant HTTP as "HTTP train routes<br/>http-api-train*.ts"
participant Tool as "MCP tool 'train'<br/>train.ts"
participant Store as "executeTrainStore<br/>train-store.ts"
participant Mem as "Memory store<br/>memory-store.ts"
participant Qdr as "Qdrant service<br/>qdrant-service.ts"
User->>CLI : "train [path] [--options]"
CLI->>HTTP : "POST /api/train (JSON/raw)"
HTTP->>Tool : "invoke train(toolParams)"
Tool->>Tool : "resolveContentForTrain()"
Tool->>Store : "executeTrainStore(input)"
alt "Artifact mode"
Store->>Mem : "storeArtifact(content, mime, name, adapterUri)"
else "Adapter mode"
Store->>Mem : "storeAdapter([markdown], modelId, opts)"
end
Store-->>Tool : "TrainStoreOutput(items)"
Tool-->>HTTP : "TrainOutput(items)"
HTTP-->>CLI : "JSON response"
CLI-->>User : "Structured output"
Note over CLI : "Auto-discover co-located artifacts<br/>during batch training"
Note over CLI : "Structured error reporting<br/>for skipped artifacts"
```

**Diagram sources**
- [cli-train.ts:77-276](file://src/cli/commands/cli-train.ts#L77-L276)
- [http-api-train-json.ts](file://src/http/http-api-train-json.ts)
- [http-api-train-raw.ts](file://src/http/http-api-train-raw.ts)
- [train.ts:134-238](file://src/tools/train.ts#L134-L238)
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [memory-store.ts](file://src/services/memory/store.ts)
- [qdrant-service.ts](file://src/services/qdrant/service.ts)

## Detailed Component Analysis

### CLI train command
- Modes:
  - Single file: reads markdown or artifact content, infers artifact mode by flags/MIME, and sends to the MCP tool or HTTP API.
  - Directory batch: recursively scans .md files (skips top-level README.md), automatically discovers co-located artifacts, applies upload guards, and streams results per file.
  - Fork mode: trains from an existing adapter by exporting its markdown and optionally overriding content.
- Enhanced artifact discovery:
  - Automatic detection of co-located artifact files during batch training
  - MIME type inference from filename extensions for discovered artifacts
  - Conditional artifact upload based on --model flag presence
  - Structured error handling for missing model or adapter URI during artifact uploads
  - Detailed error reporting with "artifact_skipped" messages for skipped artifacts
- Options:
  - Model attribution, force updates, recursive directory scanning, space targeting, artifact-specific flags, and sensitive content allowance.
- Error handling:
  - Validates presence of path, regular file semantics, and artifact mode preconditions; delegates API errors to centralized handlers.

**Updated** Added automatic co-located artifact discovery and conditional upload functionality during batch training operations with structured error reporting.

```mermaid
flowchart TD
Start(["CLI train invoked"]) --> Mode{"Path provided?"}
Mode --> |No| CheckFork{"--source-adapter-uri set?"}
CheckFork --> |Yes| ForkReq["Require --model and optional --space"]
ForkReq --> CallFork["Call trainJson with source_adapter_uri"]
CheckFork --> |No| MissingPath["Error: missing path"]
Mode --> |Yes| Stat["Stat path"]
Stat --> IsDir{"Directory?"}
IsDir --> |Yes| BatchScan["Scan .md files (recursive?)"]
BatchScan --> AnyMD{"Any .md found?"}
AnyMD --> |No| ErrNoMD["Error: no .md files"]
AnyMD --> |Yes| Loop["For each file: readMarkdownUploadFromFile -> train"]
Loop --> AutoDiscover["Auto-discover co-located artifacts"]
AutoDiscover --> CheckModel{"--model provided?"}
CheckModel --> |Yes| UploadArtifacts["Upload artifacts with MIME inference"]
CheckModel --> |No| SkipArtifacts["Skip artifacts with error message"]
UploadArtifacts --> BatchOut["Write batch results with artifacts"]
SkipArtifacts --> BatchOut
IsDir --> |No| IsArtifact{"Artifact mode?"}
IsArtifact --> |Yes| ArtifactPre["Validate --adapter, --model, --mime/name/path"]
ArtifactPre --> CallTrainJson["Call trainJson with artifact payload"]
IsArtifact --> |No| ReadMD["readMarkdownUploadFromFile"]
ReadMD --> CallTrain["Call train(toolParams)"]
CallFork --> End(["Exit"])
CallTrainJson --> End
CallTrain --> End
BatchOut --> End
MissingPath --> End
ErrNoMD --> End
```

**Diagram sources**
- [cli-train.ts:56-276](file://src/cli/commands/cli-train.ts#L56-L276)

**Section sources**
- [cli-train.ts:56-276](file://src/cli/commands/cli-train.ts#L56-L276)

### MCP tool 'train'
- Input parsing: Zod schema with strict refinements for artifact mode, relative path normalization, and mutual constraints.
- Space resolution: personal vs group spaces with validation and fallbacks.
- Execution:
  - Resolves content (supports forking from another adapter via Qdrant).
  - Determines artifact vs adapter mode and canonicalizes adapter URI for artifacts.
  - Normalizes relative paths for artifact storage.
  - Persists via executeTrainStore and constructs output URIs.
- Error formatting: maps domain errors to user-friendly messages with actionable next steps.

```mermaid
sequenceDiagram
participant Tool as "registerTrainTool(train.ts)"
participant Schema as "trainInputSchema(train_schema.ts)"
participant Exec as "executeTrain(train.ts)"
participant Store as "executeTrainStore(train-store.ts)"
participant Qdr as "Qdrant service"
participant Mem as "Memory store"
Tool->>Schema : "safeParse(params)"
Schema-->>Tool : "validated input or errors"
Tool->>Exec : "executeTrain(memoryStore, input, runStore, qdrantService)"
Exec->>Qdr : "findFirstStepMemoryUuidBySlug (if source_adapter_uri)"
Qdr-->>Exec : "layerUuid or error"
Exec->>Store : "executeTrainStore(storePayload)"
alt "Artifact mode"
Store->>Mem : "storeArtifact(...)"
else "Adapter mode"
Store->>Mem : "storeAdapter([markdown], modelId, opts)"
end
Store-->>Exec : "TrainStoreOutput"
Exec-->>Tool : "TrainOutput(items)"
Tool-->>Caller : "structuredContent"
```

**Diagram sources**
- [train.ts:240-346](file://src/tools/train.ts#L240-L346)
- [train.ts:134-238](file://src/tools/train.ts#L134-L238)
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [train_schema.ts:54-168](file://src/tools/train_schema.ts#L54-L168)
- [qdrant-service.ts](file://src/services/qdrant/service.ts)

**Section sources**
- [train.ts:240-346](file://src/tools/train.ts#L240-L346)
- [train.ts:134-238](file://src/tools/train.ts#L134-L238)
- [train_schema.ts:54-168](file://src/tools/train_schema.ts#L54-L168)

### Store-level persistence and validation
- Artifact mode:
  - Validates MIME against allowlist and content size.
  - Stores artifact under the specified adapter URI with optional relative path.
- Adapter mode:
  - Removes conflicting author slug when forking to prevent collisions.
  - Validates protocol structure and enforces required sections and contract blocks.
  - Stores adapter with optional protocol version and fork flag.

```mermaid
flowchart TD
Inp["Input payload"] --> Detect{"Is artifact mode?"}
Detect --> |Yes| MimeCheck["Normalize and validate MIME allowlist"]
MimeCheck --> SizeCheck["Validate artifact content size"]
SizeCheck --> StoreArtifact["storeArtifact(content, mime, name, adapterUri, relativePath)"]
Detect --> |No| Fork["If fork: remove author slug from frontmatter"]
Fork --> ProtoCheck["validateProtocolStructure(markdown)"]
ProtoCheck --> StoreAdapter["storeAdapter([markdown], modelId, {forceUpdate, protocolVersion, forkNewAdapter})"]
StoreArtifact --> Out["TrainStoreOutput(items)"]
StoreAdapter --> Out
```

**Diagram sources**
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [validate-protocol-structure.ts:113-187](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [frontmatter.ts:23-54](file://src/utils/frontmatter.ts#L23-L54)

**Section sources**
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [validate-protocol-structure.ts:113-187](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [frontmatter.ts:23-54](file://src/utils/frontmatter.ts#L23-L54)

### Protocol markdown syntax and validation
- Required structure:
  - At least one H1 title.
  - First H2 must be "Activation Patterns".
  - Last H2 must be "Reward Signal".
  - At least one JSON contract block with allowed types.
- Contract block rules:
  - Only ```json fences are permitted for contract blocks.
  - Contract type must be one of: tensor, shell, mcp, user_input, comment.
- Multi-adapter documents:
  - Each H1 section must satisfy the above constraints.
- Frontmatter:
  - Optional version, title, slug, chain_root; stored separately and used for versioning and chaining.

```mermaid
flowchart TD
MD["Markdown document"] --> Head["Extract headings (ignore code fences)"]
Head --> Sections["Split by H1 sections"]
Sections --> CheckFirst["First H2 == 'Activation Patterns'?"]
CheckFirst --> CheckLast["Last H2 == 'Reward Signal'?"]
CheckLast --> Fences["No plain
``` with contract JSON?"]
  Fences --> Contracts["Find all ```json blocks"]
  Contracts --> Types["Each block type in {tensor, shell, mcp, user_input, comment}?"]
  Types --> Valid{"All checks passed?"}
  Valid -->|Yes| OK["Valid"]
  Valid -->|No| Err["PROTOCOL_STRUCTURE_INVALID with details"]
```

**Diagram sources**
- [validate-protocol-structure.ts](file://src/services/memory/validate-protocol-structure.ts#L113-L187)

**Section sources**
- [validate-protocol-structure.ts](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [frontmatter.ts](file://src/utils/frontmatter.ts#L23-L54)

### Artifact attachment, MIME configuration, and relative paths
- Artifact mode detection:
  - Explicit non-markdown MIME or inferred artifact MIME from filename.
  - Automatic discovery of co-located artifacts during batch training.
- MIME handling:
  - Allowlist enforced; normalization to lowercase.
  - Inference from filename extension; unknown extensions require explicit MIME.
  - Support for common artifact types: Python (.py), Shell scripts (.sh, .bash), JavaScript (.js, .mjs, .cjs), Perl (.pl, .pm), TOML (.toml), YAML (.yaml, .yml), Text (.txt).
- Relative path handling:
  - Allowed only for artifacts; normalized and validated to be skill-root-relative without .. segments.
- Adapter URI resolution:
  - Canonicalizes adapter slugs to layer UUIDs via Qdrant when required.

**Updated** Enhanced MIME configuration now includes comprehensive support for common artifact types and automatic co-located artifact discovery during batch training with structured error reporting.

```mermaid
flowchart TD
In["Input"] --> MIME["Resolve MIME (explicit or inferred)"]
MIME --> Allowed{"Allowed artifact MIME?"}
Allowed --> |No| ErrMIME["Unsupported MIME error"]
Allowed --> |Yes| Size["Validate artifact size"]
Size --> Path["Normalize relative_path (forward slashes, no ..)"]
Path --> Store["storeArtifact(...)"]
Store --> Out["Output with artifact URI"]
```

**Diagram sources**
- [train-mime.ts](file://src/tools/train-mime.ts#L4-L22)
- [artifact-mime.ts](file://src/tools/artifact-mime.ts#L34-L50)
- [extension-mime-map.ts](file://src/tools/skill-export/artifact-sanitization/extension-mime-map.ts#L10-L27)
- [artifact-relative-path.ts](file://src/tools/artifact-relative-path.ts)
- [train-artifact-adapter-uri.ts](file://src/tools/train-artifact-adapter-uri.ts#L5-L37)

**Section sources**
- [train-mime.ts](file://src/tools/train-mime.ts#L4-L22)
- [artifact-mime.ts](file://src/tools/artifact-mime.ts#L34-L50)
- [extension-mime-map.ts](file://src/tools/skill-export/artifact-sanitization/extension-mime-map.ts#L10-L27)
- [train-artifact-adapter-uri.ts](file://src/tools/train-artifact-adapter-uri.ts#L5-L37)
- [train-output-adapter-uri.ts](file://src/tools/train-output-adapter-uri.ts#L4-L33)

### Local artifact directory configuration
- Environment-based configuration:
  - KAIROS_LOCAL_ARTIFACT_DIRS environment variable defines ordered URI hints.
  - Default values: 'project://.local/kairos/work,user://.config/kairos/work'.
  - Supports project:// and user:// schemes with safe relative paths.
- Validation rules:
  - Rejects empty lists, invalid schemes, absolute paths, and '..' traversal segments.
  - Returns frozen arrays to prevent mutations.
- Client-side resolution:
  - Server emits kairos_local_artifact_dir hints; client resolves on its own filesystem.
  - Used for artifact export and tool execution contexts.

**New Section** Added comprehensive documentation for local artifact directory configuration and environment variable handling.

**Section sources**
- [kairos-local-artifact-dirs.ts:10-40](file://src/utils/kairos-local-artifact-dirs.ts#L10-L40)
- [config.ts:57-64](file://src/config.ts#L57-L64)

### Embedding configuration and quality assurance
- Model attribution:
  - llm_model_id is required for both adapter and artifact training.
- Similarity guard:
  - Duplicate or highly similar adapters trigger warnings and guidance to use force_update with the same adapter id.
- Quality metadata:
  - Protocol version can be supplied via frontmatter or input to track adapter evolution.
- Export parity:
  - Relative paths for artifacts are preserved during skill export.

**Section sources**
- [train.ts](file://src/tools/train.ts#L56-L83)
- [train-store.ts](file://src/tools/train-store.ts#L105-L112)
- [frontmatter.ts](file://src/utils/frontmatter.ts#L23-L54)

### Examples of training workflows
- Train a new adapter from markdown:
  - Provide a markdown file with required sections and contract blocks; specify llm_model_id.
- Attach an artifact to an existing adapter:
  - Supply --adapter kairos://adapter/{slug}, --artifact-name, --mime (or infer from extension), and --model.
- Fork from an existing adapter:
  - Use --source-adapter-uri and --model; optional content override.
- Batch training from a directory:
  - Run train on a directory to process all .md files; use --recursive for nested discovery.
- Auto-upload co-located artifacts:
  - During batch training, artifacts in the same directory are automatically discovered and uploaded when --model is provided.

**Updated** Added examples for auto-upload of co-located artifacts during batch training operations.

**Section sources**
- [cli-train.ts](file://src/cli/commands/cli-train.ts#L139-L183)
- [cli-train.ts](file://src/cli/commands/cli-train.ts#L190-L256)
- [cli-train.ts](file://src/cli/commands/cli-train.ts#L96-L117)

### Error handling for malformed inputs
Common errors and guidance:
- Missing path or invalid file type: ensure a readable file or directory is provided.
- Artifact mode preconditions: adapter_uri and model are required; MIME must be allowed or inferable.
- Protocol structure invalid: ensure required sections and contract blocks conform to rules.
- Similar adapters found: use force_update with the same adapter id or adjust title/content.
- Space errors: verify personal/group space names and permissions.
- Artifact upload errors: missing model or adapter URI during batch artifact uploads.
- Artifact skipping: "artifact_skipped" messages when --model flag is missing during batch training.

**Updated** Added guidance for artifact upload errors during batch training operations including structured error reporting.

**Section sources**
- [cli-train.ts](file://src/cli/commands/cli-train.ts#L261-L272)
- [train.ts](file://src/tools/train.ts#L56-L83)
- [train-store.ts](file://src/tools/train-store.ts#L105-L112)
- [http-api-train-space-errors.test.ts](file://tests/integration/http-api-train-space-errors.test.ts)

### Performance optimization techniques
- Batch processing:
  - Use directory mode to process multiple .md files efficiently.
  - Automatic artifact discovery reduces manual intervention during training.
- Concurrency:
  - The CLI iterates sequentially; consider external batching tools for large directories.
- Content size limits:
  - Pre-validate artifact sizes to avoid repeated failures.
- Fork resolution:
  - Prefer exporting content from Qdrant when forking to reduce manual overrides.
- Artifact optimization:
  - Use --model flag to enable automatic artifact upload during batch training.
  - Organize related files in the same directory for automatic discovery.

**Updated** Added performance tips for artifact upload and batch training optimization.

**Section sources**
- [cli-train.ts](file://src/cli/commands/cli-train.ts#L150-L182)
- [train-store.ts](file://src/tools/train-store.ts#L70-L73)

### Training data preparation and validation pipelines
- Upload guards:
  - Apply sensitive content checks before reading files.
- Protocol validation:
  - Structural checks and contract block enforcement occur prior to persistence.
- Integration with external data sources:
  - Use --source-adapter-uri to import/export markdown from adapters and augment with local content.
- Artifact preparation:
  - Place related files in the same directory for automatic discovery.
  - Ensure proper filename extensions for MIME inference.
  - Use --model flag to enable automatic artifact upload during batch training.

**Updated** Added guidance for artifact preparation and automatic discovery during training.

**Section sources**
- [upload-guards.ts](file://src/cli/upload-guards.ts)
- [validate-protocol-structure.ts](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [train.ts](file://src/tools/train.ts#L85-L132)

## Dependency Analysis
The training subsystem exhibits clear layering:
- CLI depends on HTTP routes and the MCP tool.
- The MCP tool depends on schemas, MIME resolution, adapter URI resolution, and the store.
- The store depends on memory/Qdrant services and validation utilities.
- Enhanced artifact handling includes local artifact directory configuration and artifact file discovery.

**Updated** Added dependencies for artifact file discovery and local artifact directory configuration.

```mermaid
graph LR
CLI["cli-train.ts"] --> HTTP["http-api-train*.ts"]
CLI --> Tool["train.ts"]
Tool --> Schema["train_schema.ts"]
Tool --> Mime["train-mime.ts"]
Tool --> OutURI["train-output-adapter-uri.ts"]
Tool --> Store["train-store.ts"]
Store --> Proto["validate-protocol-structure.ts"]
Store --> FM["frontmatter.ts"]
Store --> AMime["artifact-mime.ts"]
AMime --> ExtMap["extension-mime-map.ts"]
Store --> Mem["memory-store.ts"]
Store --> Qdr["qdrant-service.ts"]
CLI --> ArtFiles["artifact-files.ts"]
CLI --> LocalDirs["kairos-local-artifact-dirs.ts"]
```

**Diagram sources**
- [cli-train.ts:56-276](file://src/cli/commands/cli-train.ts#L56-L276)
- [train.ts:240-346](file://src/tools/train.ts#L240-L346)
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)
- [train_schema.ts:54-168](file://src/tools/train_schema.ts#L54-L168)
- [train-mime.ts:4-22](file://src/tools/train-mime.ts#L4-L22)
- [train-output-adapter-uri.ts:4-33](file://src/tools/train-output-adapter-uri.ts#L4-L33)
- [validate-protocol-structure.ts:113-187](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [frontmatter.ts:23-54](file://src/utils/frontmatter.ts#L23-L54)
- [artifact-mime.ts:34-50](file://src/tools/artifact-mime.ts#L34-L50)
- [extension-mime-map.ts:10-27](file://src/tools/skill-export/artifact-sanitization/extension-mime-map.ts#L10-L27)
- [memory-store.ts](file://src/services/memory/store.ts)
- [qdrant-service.ts](file://src/services/qdrant/service.ts)
- [artifact-files.ts:30-87](file://src/tools/skill-export/artifact-files.ts#L30-L87)
- [kairos-local-artifact-dirs.ts:10-40](file://src/utils/kairos-local-artifact-dirs.ts#L10-L40)

**Section sources**
- [cli-train.ts:56-276](file://src/cli/commands/cli-train.ts#L56-L276)
- [train.ts:240-346](file://src/tools/train.ts#L240-L346)
- [train-store.ts:47-131](file://src/tools/train-store.ts#L47-L131)

## Performance Considerations
- Prefer artifact MIME inference from filenames to avoid redundant explicit MIME declarations.
- Use batch directory mode for bulk ingestion to minimize overhead.
- Validate artifact sizes early to prevent repeated store attempts.
- Leverage forking to reuse existing adapters and reduce manual content creation.
- Enable automatic artifact discovery by organizing related files in the same directory.
- Use --model flag during batch training to enable automatic artifact upload.

**Updated** Added performance tips for artifact upload and batch training optimization.

## Troubleshooting Guide
- "Adapter with this label already exists":
  - Use force_update to overwrite or choose a distinct label/title.
- "Adapter title is very similar to an existing one":
  - Inspect similarity matches and adjust title/content; use force_update with the same adapter id if intentional.
- "Provide content and/or source_adapter_uri":
  - Either supply content or a valid source adapter URI.
- "artifact_name is required when mime is non-markdown":
  - Provide artifact_name and adapter_uri for artifact mode.
- "mime is required when artifact_name extension is unknown":
  - Specify MIME explicitly for unrecognized extensions.
- "Invalid adapter URI":
  - Ensure adapter_uri matches kairos://adapter/{slug} and resolves via Qdrant.
- "artifact_skipped: [path] — add --model <id> to upload artifacts":
  - Add --model flag to enable artifact upload during batch training.
- "artifact_skipped: [path] — adapter_uri missing (add slug to frontmatter or use --force)":
  - Ensure adapter has a valid URI or use --force to create one.

**Updated** Added troubleshooting guidance for artifact upload errors during batch training operations including structured error reporting.

**Section sources**
- [train.ts:56-83](file://src/tools/train.ts#L56-L83)
- [train-store.ts:105-112](file://src/tools/train-store.ts#L105-L112)
- [train-artifact-adapter-uri.ts:12-36](file://src/tools/train-artifact-adapter-uri.ts#L12-L36)
- [train_schema.ts:105-152](file://src/tools/train_schema.ts#L105-L152)

## Conclusion
The KAIROS training subsystem provides robust support for registering adapters from protocol markdown and attaching artifacts to adapters. Its layered design ensures strong validation, clear error messaging, and flexible integration with Qdrant and external data sources. The enhanced CLI now includes automatic discovery and uploading of co-located artifact files during batch training, significantly improving the training workflow efficiency. By following the guidelines in this document—especially around protocol structure, artifact MIME handling, batch processing, and local artifact directory configuration—you can reliably train and evolve adapters at scale.

**Updated** Enhanced conclusion reflecting the new artifact upload capabilities and improved batch training functionality with automatic co-located artifact discovery.

## Appendices

### File format requirements and validation rules
- Protocol markdown:
  - Required sections and contract blocks; no mixed contract fences.
- Artifact content:
  - MIME must be allowed; size limits enforced; filename extension may infer MIME.
  - Common artifact types: Python (.py), Shell scripts (.sh, .bash), JavaScript (.js, .mjs, .cjs), Perl (.pl, .pm), TOML (.toml), YAML (.yaml, .yml), Text (.txt).

**Updated** Added comprehensive list of supported artifact types and MIME configurations.

**Section sources**
- [validate-protocol-structure.ts:113-187](file://src/services/memory/validate-protocol-structure.ts#L113-L187)
- [artifact-mime.ts:34-50](file://src/tools/artifact-mime.ts#L34-L50)
- [train-store.ts:70-73](file://src/tools/train-store.ts#L70-L73)
- [extension-mime-map.ts:10-27](file://src/tools/skill-export/artifact-sanitization/extension-mime-map.ts#L10-L27)

### Batch processing capabilities
- Directory scanning:
  - Recursively include .md files; skip top-level README.md.
  - Automatically discover co-located artifact files in the same directory.
- Artifact upload conditions:
  - Artifacts are uploaded only when --model flag is provided.
  - Requires valid adapter_uri from the trained adapter.
- Results:
  - Per-file outcomes with status and items returned as JSON.
  - Artifact upload results included in batch output.
  - Structured error reporting for skipped artifacts with "artifact_skipped" messages.

**Updated** Enhanced batch processing documentation to include automatic artifact discovery and conditional upload functionality with structured error reporting.

**Section sources**
- [cli-train.ts:19-42](file://src/cli/commands/cli-train.ts#L19-L42)
- [cli-train.ts:150-182](file://src/cli/commands/cli-train.ts#L150-L182)
- [cli-train-batch.test.ts:189-230](file://tests/integration/cli-train-batch.test.ts#L189-L230)

### Integration with external data sources
- Forking:
  - Export markdown from an existing adapter and optionally override content.
- Space scoping:
  - Personal or group spaces supported with validation.
- Local artifact directories:
  - Configure via KAIROS_LOCAL_ARTIFACT_DIRS environment variable.
  - Supports project:// and user:// schemes with safe relative paths.

**Updated** Added documentation for local artifact directory integration and environment variable configuration.

**Section sources**
- [train.ts:85-132](file://src/tools/train.ts#L85-L132)
- [train.ts:259-280](file://src/tools/train.ts#L259-L280)
- [kairos-local-artifact-dirs.ts:10-40](file://src/utils/kairos-local-artifact-dirs.ts#L10-L40)
- [config.ts:57-64](file://src/config.ts#L57-L64)