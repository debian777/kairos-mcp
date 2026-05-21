# Skills & Protocols

<cite>
**Referenced Files in This Document**
- [skills/README.md](file://skills/README.md)
- [skills/SKILLS.md](file://skills/SKILLS.md)
- [skills/kairos/SKILL.md](file://skills/kairos/SKILL.md)
- [src/tools/skill-export/types.ts](file://src/tools/skill-export/types.ts)
- [src/tools/skill-export/derive-metadata.ts](file://src/tools/skill-export/derive-metadata.ts)
- [src/tools/skill-export/assemble-skill-item.ts](file://src/tools/skill-export/assemble-skill-item.ts)
- [src/tools/skill-export/build-skill-md.ts](file://src/tools/skill-export/build-skill-md.ts)
- [src/tools/skill-export/scan-diagnostics.ts](file://src/tools/skill-export/scan-diagnostics.ts)
- [src/tools/skill-export/artifact-files.ts](file://src/tools/skill-export/artifact-files.ts)
- [src/tools/skill-export/zip-bundle.ts](file://src/tools/skill-export/zip-bundle.ts)
- [src/tools/export-skill-items.ts](file://src/tools/export-skill-items.ts)
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/services/memory/validate-protocol-structure.ts](file://src/services/memory/validate-protocol-structure.ts)
- [src/utils/protocol-slug.ts](file://src/utils/protocol-slug.ts)
</cite>

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
This document explains how KAIROS MCP manages skills and protocols, and how to develop, author, validate, export, and distribute them. It covers:
- Skill development and structure for authors
- Protocol authoring with markdown syntax, contract definitions, and validation rules
- Skill bundle creation, metadata derivation, and artifact attachment
- Practical examples for developing skills, authoring protocols, and training
- Distribution, version management, and compatibility considerations
- The relationship between skills, protocols, and the training workflow

## Project Structure
KAIROS MCP organizes skills and protocols across two primary areas:
- skills/: Human-authored skill packages for installation and use
- src/tools/: Server-side tools implementing training, tuning, exporting, and skill bundling

```mermaid
graph TB
subgraph "Skills (Human-authored)"
S1["skills/README.md"]
S2["skills/SKILLS.md"]
S3["skills/kairos/SKILL.md"]
end
subgraph "Server Tools"
T1["src/tools/train.ts"]
T2["src/tools/tune.ts"]
T3["src/tools/export.ts"]
T4["src/tools/dump.ts"]
end
subgraph "Skill Export Pipeline"
E1["src/tools/export-skill-items.ts"]
E2["src/tools/skill-export/assemble-skill-item.ts"]
E3["src/tools/skill-export/derive-metadata.ts"]
E4["src/tools/skill-export/build-skill-md.ts"]
E5["src/tools/skill-export/artifact-files.ts"]
E6["src/tools/skill-export/zip-bundle.ts"]
end
S3 --> T1
T1 --> T4
T3 --> E1
E1 --> E2
E2 --> E3
E2 --> E4
E2 --> E5
E1 --> E6
```

**Diagram sources**
- [skills/README.md:1-68](file://skills/README.md#L1-L68)
- [skills/SKILLS.md:1-62](file://skills/SKILLS.md#L1-L62)
- [skills/kairos/SKILL.md:1-163](file://skills/kairos/SKILL.md#L1-L163)
- [src/tools/train.ts:1-346](file://src/tools/train.ts#L1-L346)
- [src/tools/tune.ts:1-58](file://src/tools/tune.ts#L1-L58)
- [src/tools/export.ts:1-315](file://src/tools/export.ts#L1-L315)
- [src/tools/dump.ts:1-190](file://src/tools/dump.ts#L1-L190)
- [src/tools/export-skill-items.ts:1-56](file://src/tools/export-skill-items.ts#L1-L56)
- [src/tools/skill-export/assemble-skill-item.ts:1-80](file://src/tools/skill-export/assemble-skill-item.ts#L1-L80)
- [src/tools/skill-export/derive-metadata.ts:1-113](file://src/tools/skill-export/derive-metadata.ts#L1-L113)
- [src/tools/skill-export/build-skill-md.ts:1-23](file://src/tools/skill-export/build-skill-md.ts#L1-L23)
- [src/tools/skill-export/artifact-files.ts:1-88](file://src/tools/skill-export/artifact-files.ts#L1-L88)
- [src/tools/skill-export/zip-bundle.ts:1-67](file://src/tools/skill-export/zip-bundle.ts#L1-L67)

**Section sources**
- [skills/README.md:1-68](file://skills/README.md#L1-L68)
- [skills/SKILLS.md:1-62](file://skills/SKILLS.md#L1-L62)
- [skills/kairos/SKILL.md:1-163](file://skills/kairos/SKILL.md#L1-L163)

## Core Components
- Skills: Human-authored packages installed via the skills CLI, containing a SKILL.md frontmatter and optional assets, scripts, and references.
- Protocols: Structured markdown documents describing adapter workflows with required sections and JSON contract blocks.
- Training and Tuning: Tools to register new adapters and update existing ones from markdown or artifacts.
- Export and Bundling: Tools to export adapters as markdown, training JSONL, or skill bundles (ZIP) with metadata and diagnostics.

**Section sources**
- [skills/README.md:1-68](file://skills/README.md#L1-L68)
- [skills/SKILLS.md:1-62](file://skills/SKILLS.md#L1-L62)
- [src/tools/train.ts:1-346](file://src/tools/train.ts#L1-L346)
- [src/tools/tune.ts:1-58](file://src/tools/tune.ts#L1-L58)
- [src/tools/export.ts:1-315](file://src/tools/export.ts#L1-L315)

## Architecture Overview
The skill and protocol lifecycle spans human-authored content and server-side processing:

```mermaid
sequenceDiagram
participant Author as "Skill Author"
participant Repo as "skills/"
participant Server as "KAIROS MCP Server"
participant Store as "Memory/Qdrant"
participant Export as "Export Tool"
Author->>Repo : Create SKILL.md + references/assets
Author->>Server : Train protocol (markdown or artifact)
Server->>Store : Persist adapter layers and metadata
Author->>Server : Export adapter or training data
Server->>Export : Build skill items and artifacts
Export-->>Author : skill_tree/skill_zip with diagnostics
```

**Diagram sources**
- [skills/SKILLS.md:16-47](file://skills/SKILLS.md#L16-L47)
- [src/tools/train.ts:134-238](file://src/tools/train.ts#L134-L238)
- [src/tools/export.ts:40-269](file://src/tools/export.ts#L40-L269)
- [src/tools/export-skill-items.ts:17-55](file://src/tools/export-skill-items.ts#L17-L55)

## Detailed Component Analysis

### Skill Development System
- Template structure: Each skill is a directory with a required SKILL.md frontmatter and optional references/, assets/, scripts/.
- Validation: Optional validation via skills-ref aligns with the Agent Skills specification.
- Distribution: Skills are installed globally or per-project via the skills CLI.

```mermaid
flowchart TD
Start(["Author creates skill"]) --> Frontmatter["Add YAML frontmatter<br/>name, description, metadata"]
Frontmatter --> Body["Write markdown body<br/>usage, guidance, references"]
Body --> Assets["Optional: assets/, scripts/, references/"]
Assets --> Validate["Optional: skills-ref validation"]
Validate --> Publish["Publish to skills directory<br/>install via npx skills add"]
```

**Diagram sources**
- [skills/SKILLS.md:16-47](file://skills/SKILLS.md#L16-L47)
- [skills/README.md:12-67](file://skills/README.md#L12-L67)

**Section sources**
- [skills/SKILLS.md:16-62](file://skills/SKILLS.md#L16-L62)
- [skills/README.md:1-68](file://skills/README.md#L1-L68)

### Protocol Management and Validation
- Markdown syntax: Protocols are authored as markdown with required sections and JSON contract blocks.
- Contract definitions: Each step includes a JSON block with a type field (shell, mcp, user_input, comment, tensor).
- Validation rules: Structural checks ensure presence of Activation Patterns (first H2), Reward Signal (last H2), at least one JSON contract block, consistent fencing, and allowed contract types.

```mermaid
flowchart TD
PStart(["Protocol Markdown"]) --> Headings["Extract H1/H2 headings<br/>ignore code fences"]
Headings --> Sections["Split by H1 sections"]
Sections --> CheckFirst["First H2 == 'Activation Patterns'?"]
Sections --> CheckLast["Last H2 == 'Reward Signal'?"]
Headings --> Contracts["Find JSON contract blocks"]
Contracts --> FenceCheck["Reject plain
``` with contract JSON"]
  Contracts --> TypeCheck["Validate type in {tensor,shell,mcp,user_input,comment}"]
  CheckFirst --> Valid{"All checks pass?"}
  CheckLast --> Valid
  FenceCheck --> Valid
  TypeCheck --> Valid
  Valid -->|Yes| Accept["Accept protocol"]
  Valid -->|No| Reject["Reject with structured reasons"]
```

**Diagram sources**
- [src/services/memory/validate-protocol-structure.ts:113-186](file://src/services/memory/validate-protocol-structure.ts#L113-L186)

**Section sources**
- [src/services/memory/validate-protocol-structure.ts:113-186](file://src/services/memory/validate-protocol-structure.ts#L113-L186)

### Skill Bundle Creation and Metadata Derivation
- Assembly: For each adapter URI, the system dumps protocol markdown, normalizes vocabulary, derives metadata (slug, name, description), builds SKILL.md, scans for diagnostics, loads artifacts, and computes checksums.
- Deduplication: Slugs are deduplicated and remapped to avoid collisions.
- Packaging: Files are flattened into ZIP layout with a manifest and optional inline base64 encoding.

```mermaid
sequenceDiagram
participant Client as "Caller"
participant Export as "executeExport"
participant Items as "collectSkillExportItemsForZip"
participant Assemble as "assembleSkillExportItem"
participant Meta as "deriveSkillMetadata"
participant Build as "buildSkillMdFile"
participant Art as "loadArtifactFilesForAdapter"
participant Zip as "zipSkillFiles"
Client->>Export : format=skill_zip
Export->>Items : resolve adapter URIs -> items
loop For each adapter
Items->>Assemble : dump + derive metadata
Assemble->>Meta : compute slug/name/description
Assemble->>Build : generate SKILL.md
Assemble->>Art : attach artifacts
Assemble-->>Items : SkillExportItem
end
Items-->>Export : items + primaryUri
Export->>Zip : flatten + zip
Export-->>Client : download_ref or inline base64
```

**Diagram sources**
- [src/tools/export.ts:176-264](file://src/tools/export.ts#L176-L264)
- [src/tools/export-skill-items.ts:17-55](file://src/tools/export-skill-items.ts#L17-L55)
- [src/tools/skill-export/assemble-skill-item.ts:32-79](file://src/tools/skill-export/assemble-skill-item.ts#L32-L79)
- [src/tools/skill-export/derive-metadata.ts:62-99](file://src/tools/skill-export/derive-metadata.ts#L62-L99)
- [src/tools/skill-export/build-skill-md.ts:18-22](file://src/tools/skill-export/build-skill-md.ts#L18-L22)
- [src/tools/skill-export/artifact-files.ts:30-87](file://src/tools/skill-export/artifact-files.ts#L30-L87)
- [src/tools/skill-export/zip-bundle.ts:39-53](file://src/tools/skill-export/zip-bundle.ts#L39-L53)

**Section sources**
- [src/tools/export.ts:40-269](file://src/tools/export.ts#L40-L269)
- [src/tools/export-skill-items.ts:17-55](file://src/tools/export-skill-items.ts#L17-L55)
- [src/tools/skill-export/assemble-skill-item.ts:32-79](file://src/tools/skill-export/assemble-skill-item.ts#L32-L79)
- [src/tools/skill-export/derive-metadata.ts:62-99](file://src/tools/skill-export/derive-metadata.ts#L62-L99)
- [src/tools/skill-export/build-skill-md.ts:18-22](file://src/tools/skill-export/build-skill-md.ts#L18-L22)
- [src/tools/skill-export/artifact-files.ts:30-87](file://src/tools/skill-export/artifact-files.ts#L30-L87)
- [src/tools/skill-export/zip-bundle.ts:11-67](file://src/tools/skill-export/zip-bundle.ts#L11-L67)

### Training Workflow and Execution Patterns
- Train tool: Validates inputs, resolves content (from input or source adapter), normalizes artifact paths, stores adapter layers, and returns URIs and metadata.
- Tune tool: Updates adapter content via Qdrant service.
- Dump tool: Converts stored layers into markdown with protocol frontmatter and optional contract blocks.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Train as "registerTrainTool"
participant Exec as "executeTrain"
participant Dump as "executeDump"
participant Store as "Memory Store"
Client->>Train : train(input)
Train->>Exec : parse + validate + resolve content
Exec->>Store : persist adapter layers
Exec-->>Client : items with uris and metadata
Client->>Dump : dump(kairos : //layer/{uuid})
Dump-->>Client : markdown with protocol frontmatter
```

**Diagram sources**
- [src/tools/train.ts:240-345](file://src/tools/train.ts#L240-L345)
- [src/tools/dump.ts:107-189](file://src/tools/dump.ts#L107-L189)

**Section sources**
- [src/tools/train.ts:134-238](file://src/tools/train.ts#L134-L238)
- [src/tools/tune.ts:12-57](file://src/tools/tune.ts#L12-L57)
- [src/tools/dump.ts:107-189](file://src/tools/dump.ts#L107-L189)

### Practical Examples

- Developing a skill
  - Create a directory under skills/ with a SKILL.md frontmatter and markdown body.
  - Optionally add references/, assets/, scripts/.
  - Validate locally with skills-ref if available.
  - Install via npx skills add debian777/kairos-mcp.

- Authoring a protocol
  - Write markdown with an H1 title and ordered H2 sections.
  - Include Activation Patterns as the first H2 and Reward Signal as the last H2.
  - Add JSON contract blocks with allowed types.
  - Use the validateProtocolStructure checks to ensure compliance.

- Training and tuning
  - Use the train tool to register a new adapter from markdown or artifact.
  - Use the tune tool to update an existing adapter’s content.
  - Use dump to render a markdown representation of an adapter chain.

- Exporting and distributing
  - Use export with format=skill_zip to produce a ZIP bundle with a manifest and optional inline base64.
  - Use export with format=skill_tree to receive a JSON tree of skill items.
  - Use export with format=reward_jsonl, sft_jsonl, or preference_jsonl for training datasets.

**Section sources**
- [skills/SKILLS.md:16-62](file://skills/SKILLS.md#L16-L62)
- [src/services/memory/validate-protocol-structure.ts:113-186](file://src/services/memory/validate-protocol-structure.ts#L113-L186)
- [src/tools/train.ts:240-345](file://src/tools/train.ts#L240-L345)
- [src/tools/tune.ts:12-57](file://src/tools/tune.ts#L12-L57)
- [src/tools/export.ts:176-264](file://src/tools/export.ts#L176-L264)

### Version Management and Compatibility
- Protocol versioning: Protocols carry an adapter_version when present; exports include adapter_version for single-adapter selections.
- Slug normalization: Deterministic slugs derived from titles or frontmatter; collisions are handled with auto-suffixes up to a limit.
- Compatibility: Skills specify allowed-tools and metadata.version; clients should respect tool availability and version constraints.

**Section sources**
- [src/tools/dump.ts:157-166](file://src/tools/dump.ts#L157-L166)
- [src/utils/protocol-slug.ts:58-91](file://src/utils/protocol-slug.ts#L58-L91)
- [skills/kairos/SKILL.md:15-19](file://skills/kairos/SKILL.md#L15-L19)

## Dependency Analysis
The skill export pipeline composes several modules with clear responsibilities and minimal coupling.

```mermaid
graph LR
Export["export.ts"] --> Items["export-skill-items.ts"]
Items --> Assemble["skill-export/assemble-skill-item.ts"]
Assemble --> Derive["skill-export/derive-metadata.ts"]
Assemble --> Build["skill-export/build-skill-md.ts"]
Assemble --> Art["skill-export/artifact-files.ts"]
Items --> Zip["skill-export/zip-bundle.ts"]
```

**Diagram sources**
- [src/tools/export.ts:16-25](file://src/tools/export.ts#L16-L25)
- [src/tools/export-skill-items.ts:7-12](file://src/tools/export-skill-items.ts#L7-L12)
- [src/tools/skill-export/assemble-skill-item.ts:5-12](file://src/tools/skill-export/assemble-skill-item.ts#L5-L12)
- [src/tools/skill-export/derive-metadata.ts:5-6](file://src/tools/skill-export/derive-metadata.ts#L5-L6)
- [src/tools/skill-export/build-skill-md.ts:5-6](file://src/tools/skill-export/build-skill-md.ts#L5-L6)
- [src/tools/skill-export/artifact-files.ts:5-14](file://src/tools/skill-export/artifact-files.ts#L5-L14)
- [src/tools/skill-export/zip-bundle.ts:5-8](file://src/tools/skill-export/zip-bundle.ts#L5-L8)

**Section sources**
- [src/tools/export.ts:16-25](file://src/tools/export.ts#L16-L25)
- [src/tools/export-skill-items.ts:7-12](file://src/tools/export-skill-items.ts#L7-L12)
- [src/tools/skill-export/assemble-skill-item.ts:5-12](file://src/tools/skill-export/assemble-skill-item.ts#L5-L12)
- [src/tools/skill-export/derive-metadata.ts:5-6](file://src/tools/skill-export/derive-metadata.ts#L5-L6)
- [src/tools/skill-export/build-skill-md.ts:5-6](file://src/tools/skill-export/build-skill-md.ts#L5-L6)
- [src/tools/skill-export/artifact-files.ts:5-14](file://src/tools/skill-export/artifact-files.ts#L5-L14)
- [src/tools/skill-export/zip-bundle.ts:5-8](file://src/tools/skill-export/zip-bundle.ts#L5-L8)

## Performance Considerations
- Export streaming: ZIP archives are streamed to avoid buffering the full archive in memory.
- Compression level: Configurable compression level reduces bundle size during skill_zip delivery.
- Caching: Dump reads leverage a Redis cache for memory resources to reduce latency.
- Validation: Structural validation is lightweight and performed before storage to prevent downstream errors.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Training errors: The train tool normalizes error codes and enriches messages with actionable next actions (e.g., opening the creation flow).
- Duplicate or similar adapters: Errors distinguish between duplicates and near-duplicates; use force_update when appropriate.
- Export diagnostics: The export pipeline scans for advisory risks in Markdown and logs warnings for invalid artifact paths or mismatched hashes.
- Protocol validation failures: Use the validation rules to identify missing sections, incorrect contract types, or mixed fencing.

**Section sources**
- [src/tools/train.ts:56-83](file://src/tools/train.ts#L56-L83)
- [src/tools/export.ts:266-268](file://src/tools/export.ts#L266-L268)
- [src/tools/skill-export/scan-diagnostics.ts:15-23](file://src/tools/skill-export/scan-diagnostics.ts#L15-L23)
- [src/services/memory/validate-protocol-structure.ts:163-186](file://src/services/memory/validate-protocol-structure.ts#L163-L186)

## Conclusion
KAIROS MCP provides a robust framework for skills and protocols:
- Skills are authored following a standardized structure and validated via the Agent Skills specification.
- Protocols are authored with strict markdown and contract rules to ensure reliable execution.
- Training, tuning, and exporting are integrated into MCP tools with clear error handling and observability.
- Skill bundles streamline distribution with metadata, diagnostics, and artifact attachments.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Appendix A: Skill Metadata Derivation
- Priority order for slug/name/description: frontmatter name/slug, memory slug, adapter name, H1 title, label fallback.
- Slug normalization ensures deterministic routing and length limits.

**Section sources**
- [src/tools/skill-export/derive-metadata.ts:62-99](file://src/tools/skill-export/derive-metadata.ts#L62-L99)
- [src/utils/protocol-slug.ts:26-36](file://src/utils/protocol-slug.ts#L26-L36)

### Appendix B: Export Formats and Delivery
- skill_tree: JSON tree of skill items with files and diagnostics.
- skill_zip: ZIP bundle with manifest; supports inline_base64 or download_ref.
- Training JSONL: trace_jsonl, reward_jsonl, sft_jsonl, preference_jsonl for adapter-specific training.

**Section sources**
- [src/tools/export.ts:176-264](file://src/tools/export.ts#L176-L264)