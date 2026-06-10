# Tune Tool

<cite>
**Referenced Files in This Document**
- [tune.ts](file://src/tools/tune.ts)
- [tune-execute.ts](file://src/tools/tune-execute.ts)
- [tune_schema.ts](file://src/tools/tune_schema.ts)
- [tune-messages.ts](file://src/tools/tune-messages.ts)
- [tune-cache-invalidation.ts](file://src/tools/tune-cache-invalidation.ts)
- [tune-verify.ts](file://src/tools/tune-verify.ts)
- [redis-cache.ts](file://src/services/redis-cache.ts)
- [http-api-update.ts](file://src/http/http-api-update.ts)
- [update.ts](file://src/tools/update.ts)
- [validate-adapter-markdown-size.ts](file://src/services/memory/validate-adapter-markdown-size.ts)
- [protected-space-write-guard.ts](file://src/utils/protected-space-write-guard.ts)
- [tune.md](file://src/embed-docs/tools/tune.md)
- [workflow-tune.md](file://docs/architecture/workflow-tune.md)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive cache invalidation system for adapter tuning operations
- Enhanced tune execution flow with post-write verification capabilities
- Improved Redis cache service with bounded TTL and strict invalidation methods
- Updated main tune tool registration to accept memory store dependencies
- Integrated cache invalidation process into the core execution flow

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Cache Invalidation System](#cache-invalidation-system)
7. [Post-Write Verification](#post-write-verification)
8. [Dependency Analysis](#dependency-analysis)
9. [Performance Considerations](#performance-considerations)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Conclusion](#conclusion)
12. [Appendices](#appendices)

## Introduction
The Tune Tool enables in-place updates to existing stored adapter content and optional space reassignment. It supports updating either:
- Full adapter content via Markdown bodies (preferred for textual changes), or
- Individual layer fields via advanced updates.

The system now includes a comprehensive cache invalidation framework to ensure data consistency across distributed systems. It integrates with the training pipeline by complementing the Train Tool for structural changes and enabling iterative protocol improvements without disrupting adapter identity. The system enforces size limits, protected space rules, and provides robust error reporting and messaging with enhanced cache management.

## Project Structure
The Tune Tool spans several modules with enhanced cache management:
- Tool registration and orchestration with memory store dependencies
- Execution engine for in-place updates and space moves with cache invalidation
- HTTP API binding
- Validation utilities and messaging helpers
- Cache invalidation utilities and verification system
- Redis cache service enhancements
- Documentation and workflow specs

```mermaid
graph TB
subgraph "Tool Layer"
TReg["tune.ts<br/>registerTuneTool(memoryStore)"]
Exec["tune-execute.ts<br/>executeTune()"]
Msg["tune-messages.ts<br/>rewriteTuneMessage()<br/>buildTuneResultMessage()"]
Verify["tune-verify.ts<br/>verifyCacheConsistency()"]
end
subgraph "Cache Management"
CacheInv["tune-cache-invalidation.ts<br/>invalidateAdapterCache()"]
RedisCache["redis-cache.ts<br/>bounded TTL & strict invalidation"]
end
subgraph "Validation & Guards"
Val["validate-adapter-markdown-size.ts<br/>validateAdapterMarkdownSize()"]
Guard["protected-space-write-guard.ts<br/>isProtectedWriteSpace()"]
end
subgraph "HTTP API"
Http["http-api-update.ts<br/>setupUpdateRoute()"]
end
subgraph "Shared Utilities"
Upd["update.ts<br/>executeUpdate()"]
Schema["tune_schema.ts<br/>tuneInputSchema / tuneOutputSchema"]
end
TReg --> Exec
Exec --> CacheInv
Exec --> Verify
Exec --> Val
Exec --> Guard
Exec --> Upd
Exec --> Msg
CacheInv --> RedisCache
Verify --> RedisCache
Http --> Exec
TReg --> Schema
Http --> Schema
```

**Diagram sources**
- [tune.ts:12-57](file://src/tools/tune.ts#L12-L57)
- [tune-execute.ts:216-347](file://src/tools/tune-execute.ts#L216-L347)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)
- [redis-cache.ts:1-150](file://src/services/redis-cache.ts#L1-L150)
- [tune-messages.ts:7-22](file://src/tools/tune-messages.ts#L7-L22)
- [http-api-update.ts:11-34](file://src/http/http-api-update.ts#L11-L34)
- [update.ts:8-72](file://src/tools/update.ts#L8-L72)
- [validate-adapter-markdown-size.ts:33-108](file://src/services/memory/validate-adapter-markdown-size.ts#L33-L108)
- [protected-space-write-guard.ts:5-16](file://src/utils/protected-space-write-guard.ts#L5-L16)
- [tune_schema.ts:14-50](file://src/tools/tune_schema.ts#L14-L50)

**Section sources**
- [tune.ts:12-57](file://src/tools/tune.ts#L12-L57)
- [tune-execute.ts:216-347](file://src/tools/tune-execute.ts#L216-L347)
- [http-api-update.ts:11-34](file://src/http/http-api-update.ts#L11-L34)
- [tune_schema.ts:14-50](file://src/tools/tune_schema.ts#L14-L50)

## Core Components
- Input schema: Defines accepted fields, constraints, and validations for Tune Tool requests.
- Output schema: Standardizes per-target results and aggregated counts.
- Tool registration: Binds the Tune Tool to the MCP server with input/output schemas, metrics, and memory store dependencies.
- Execution engine: Orchestrates normalization, validation, updates, optional space moves, and cache invalidation.
- HTTP API: Exposes POST /api/tune with request parsing and response formatting.
- Cache invalidation system: Manages distributed cache consistency across adapter updates.
- Post-write verification: Ensures cache state integrity after write operations.
- Messaging helpers: Produces user-friendly messages and normalizes error text.
- Validation and guards: Enforces Markdown size limits and protected space rules.

**Section sources**
- [tune_schema.ts:14-50](file://src/tools/tune_schema.ts#L14-L50)
- [tune.ts:12-57](file://src/tools/tune.ts#L12-L57)
- [tune-execute.ts:216-347](file://src/tools/tune-execute.ts#L216-L347)
- [http-api-update.ts:11-34](file://src/http/http-api-update.ts#L11-L34)
- [tune-messages.ts:7-22](file://src/tools/tune-messages.ts#L7-L22)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)
- [redis-cache.ts:1-150](file://src/services/redis-cache.ts#L1-L150)
- [validate-adapter-markdown-size.ts:33-108](file://src/services/memory/validate-adapter-markdown-size.ts#L33-L108)
- [protected-space-write-guard.ts:5-16](file://src/utils/protected-space-write-guard.ts#L5-L16)

## Architecture Overview
The Tune Tool follows a layered architecture with enhanced cache management:
- HTTP layer validates JSON and delegates to the execution engine.
- Tool layer parses MCP input, applies loose schema compatibility, and invokes execution with memory store dependencies.
- Execution layer resolves URIs, validates content, applies updates, optionally reassigns spaces, and triggers cache invalidation.
- Cache management layer handles distributed cache consistency and verification.
- Shared utilities handle validation, messaging, and Redis cache operations.

```mermaid
sequenceDiagram
participant Client as "Client"
participant HTTP as "HTTP Route /api/tune"
participant Tool as "MCP Tool tune.ts"
participant Exec as "executeTune()"
participant CacheInv as "Cache Invalidation"
participant Verify as "Post-Write Verify"
participant Qdrant as "QdrantService"
Client->>HTTP : POST /api/tune {uris, content?, updates?, space?}
HTTP->>HTTP : Parse & validate JSON
HTTP->>Exec : executeTune(qdrant, input, memoryStore)
Exec->>Exec : Normalize URIs, resolve adapter layers
Exec->>Qdrant : updateMemory(...) per layer
Qdrant-->>Exec : Acknowledged updates
Exec->>CacheInv : invalidateAdapterCache(layerUUIDs)
CacheInv->>Verify : verifyCacheConsistency()
Verify-->>Exec : Cache verified
Exec-->>HTTP : {results, total_updated, total_failed}
HTTP-->>Client : 200 OK JSON
```

**Diagram sources**
- [http-api-update.ts:11-34](file://src/http/http-api-update.ts#L11-L34)
- [tune.ts:22-54](file://src/tools/tune.ts#L22-L54)
- [tune-execute.ts:216-347](file://src/tools/tune-execute.ts#L216-L347)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)

## Detailed Component Analysis

### Input Schema and Validation
- Accepts:
  - uris: Non-empty array of adapter or layer URIs.
  - content: Optional array of Markdown bodies (parallel to uris).
  - updates: Optional record of advanced field updates.
  - space: Optional target space identifier ("personal" or group path).
- Validation ensures:
  - content length equals uris length when provided.
  - At least one of content, updates, or space is provided.
  - Adapter Markdown size limits apply when editing full adapters.

```mermaid
flowchart TD
Start(["Input Received"]) --> CheckUris["Check non-empty uris"]
CheckUris --> ContentLen{"content provided?"}
ContentLen --> |Yes| LenMatch{"content.length == uris.length?"}
LenMatch --> |No| Err1["Add issue: content length mismatch"]
LenMatch --> |Yes| Proceed["Proceed"]
ContentLen --> |No| AdvFields{"updates or space provided?"}
AdvFields --> |No| Err2["Add issue: provide content, updates, or space"]
AdvFields --> |Yes| Proceed
Proceed --> End(["Validated"])
Err1 --> End
Err2 --> End
```

**Diagram sources**
- [tune_schema.ts:24-40](file://src/tools/tune_schema.ts#L24-L40)

**Section sources**
- [tune_schema.ts:14-40](file://src/tools/tune_schema.ts#L14-L40)
- [workflow-tune.md:47-65](file://docs/architecture/workflow-tune.md#L47-L65)

### Output Schema and Messaging
- Output includes:
  - results: Per-target entries with uri, status, and message.
  - total_updated: Count of successful updates.
  - total_failed: Count of failures.
- Messages are normalized to refer to adapter layers consistently and replace legacy terms.

```mermaid
classDiagram
class TuneOutput {
+results : ResultEntry[]
+total_updated : number
+total_failed : number
}
class ResultEntry {
+uri : string
+status : "updated"|"error"
+message : string
}
TuneOutput --> ResultEntry : "contains"
```

**Diagram sources**
- [tune_schema.ts:42-50](file://src/tools/tune_schema.ts#L42-L50)

**Section sources**
- [tune_schema.ts:42-50](file://src/tools/tune_schema.ts#L42-L50)
- [tune-messages.ts:13-22](file://src/tools/tune-messages.ts#L13-L22)

### Execution Engine: Applying Changes
Key steps:
- Resolve target URIs:
  - Layer URIs remain as-is.
  - Adapter URIs resolve to the head layer of the adapter set.
- Normalize URIs and collect layer UUIDs:
  - Select adapter layers considering space context and preferred space.
  - Assert writable spaces.
- Apply updates:
  - Full adapter Markdown in-place rebuilds layers while preserving adapter identity.
  - Layer-specific updates use the shared update executor.
- Trigger cache invalidation:
  - Invalidate cached representations of updated layers.
  - Ensure distributed cache consistency across system nodes.
- Optional space reassignment:
  - Moves all layers of each adapter to the target space after successful updates.

```mermaid
flowchart TD
A["Input uris"] --> B["Normalize URIs"]
B --> C{"Adapter or Layer?"}
C --> |Adapter| D["Resolve adapter -> head layer"]
C --> |Layer| E["Use layer uuid"]
D --> F["Collect layer uuids"]
E --> F
F --> G{"Writable space?"}
G --> |No| H["Throw protected space error"]
G --> |Yes| I{"Full adapter Markdown?"}
I --> |Yes| J["Validate size & rebuild layers"]
I --> |No| K["Delegate to executeUpdate()"]
J --> L["Update memory rows"]
K --> L
L --> M["Trigger Cache Invalidation"]
M --> N["Verify Cache Consistency"]
N --> O{"space provided?"}
O --> |Yes| P["Reassign layers to target space"]
O --> |No| Q["Done"]
P --> Q
```

**Diagram sources**
- [tune-execute.ts:87-124](file://src/tools/tune-execute.ts#L87-L124)
- [tune-execute.ts:126-214](file://src/tools/tune-execute.ts#L126-L214)
- [tune-execute.ts:291-340](file://src/tools/tune-execute.ts#L291-L340)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)
- [update.ts:8-72](file://src/tools/update.ts#L8-L72)

**Section sources**
- [tune-execute.ts:216-347](file://src/tools/tune-execute.ts#L216-L347)
- [tune-execute.ts:87-124](file://src/tools/tune-execute.ts#L87-L124)
- [tune-execute.ts:126-214](file://src/tools/tune-execute.ts#L126-L214)
- [update.ts:8-72](file://src/tools/update.ts#L8-L72)

### HTTP API Integration
- Route: POST /api/tune
- Behavior:
  - Parses and validates JSON against the input schema.
  - Executes within the space context.
  - Returns structured JSON with results and totals.
  - Logs structured info and errors.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "setupUpdateRoute()"
participant Exec as "executeTune()"
participant Logger as "structuredLogger"
Client->>Route : POST /api/tune {JSON}
Route->>Route : safeParse(req.body)
alt Invalid input
Route-->>Client : 400 INVALID_INPUT
else Valid input
Route->>Exec : runHttpApiWithSpaceContext(...)
Exec-->>Route : {results,total_updated,total_failed}
Route->>Logger : info("tune completed")
Route-->>Client : 200 JSON
end
```

**Diagram sources**
- [http-api-update.ts:11-34](file://src/http/http-api-update.ts#L11-L34)

**Section sources**
- [http-api-update.ts:11-34](file://src/http/http-api-update.ts#L11-L34)

### Message Processing and Human-Friendly Outputs
- Rewrites generic memory references to adapter layer terminology.
- Normalizes error messages to include the affected layer URI.
- Builds success messages indicating the updated layer.

**Section sources**
- [tune-messages.ts:7-22](file://src/tools/tune-messages.ts#L7-L22)

### Version Management and Protocol Integrity
- Full adapter Markdown updates:
  - Validates total size and per-line constraints.
  - Parses frontmatter to propagate protocol version to rebuilt layers.
  - Ensures adapter identity remains unchanged by requiring matching H1-derived adapter UUID.
  - Enforces equal layer counts; structural changes require Train Tool with force_update.
- Layer-only updates:
  - Apply advanced field updates or body content with per-line and total size checks.

**Section sources**
- [tune-execute.ts:126-214](file://src/tools/tune-execute.ts#L126-L214)
- [validate-adapter-markdown-size.ts:33-108](file://src/services/memory/validate-adapter-markdown-size.ts#L33-L108)

### Conflict Resolution and Safety Guards
- Protected space guard prevents modifications to system/app spaces.
- Size validators prevent oversized or malformed Markdown bodies.
- Strict equality checks for adapter identity and layer counts.

**Section sources**
- [protected-space-write-guard.ts:5-16](file://src/utils/protected-space-write-guard.ts#L5-L16)
- [validate-adapter-markdown-size.ts:33-108](file://src/services/memory/validate-adapter-markdown-size.ts#L33-L108)
- [tune-execute.ts:159-170](file://src/tools/tune-execute.ts#L159-L170)

### Integration with Training Pipeline
- Use Tune for in-place edits without changing adapter identity.
- Use Train with force_update for structural changes (e.g., H1 change or layer count changes).

**Section sources**
- [workflow-tune.md:108-114](file://docs/architecture/workflow-tune.md#L108-L114)

## Cache Invalidation System

### Overview
The cache invalidation system ensures data consistency across distributed components after adapter updates. It provides bounded TTL management and strict invalidation methods to prevent stale cache states.

### Key Components
- **tune-cache-invalidation.ts**: Core cache invalidation logic with UUID-based targeting
- **Redis cache service enhancements**: Bounded TTL and strict invalidation methods
- **Memory store integration**: Direct dependency injection for cache operations

### Cache Invalidation Flow
```mermaid
flowchart TD
A["Adapter Update Complete"] --> B["Extract Layer UUIDs"]
B --> C["Generate Cache Keys"]
C --> D["Apply Bounded TTL"]
D --> E["Execute Strict Invalidation"]
E --> F["Broadcast Cache Events"]
F --> G["Verify Cache State"]
```

**Diagram sources**
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [redis-cache.ts:1-150](file://src/services/redis-cache.ts#L1-L150)

**Section sources**
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [redis-cache.ts:1-150](file://src/services/redis-cache.ts#L1-L150)

## Post-Write Verification

### Purpose
Post-write verification ensures cache consistency and data integrity after adapter updates, preventing stale reads and maintaining system reliability.

### Verification Process
- **Cache State Validation**: Verifies that invalidated cache entries are properly cleared
- **Data Consistency Checks**: Ensures updated content is immediately accessible
- **Error Detection**: Identifies and reports cache synchronization failures

### Integration Points
- Triggered automatically after successful cache invalidation
- Provides feedback loop for cache management system
- Supports rollback mechanisms for failed verifications

**Section sources**
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)

## Dependency Analysis
```mermaid
graph LR
TuneTS["tune.ts"] --> TuneExecute["tune-execute.ts"]
TuneTS --> TuneSchema["tune_schema.ts"]
TuneExecute --> CacheInvalidation["tune-cache-invalidation.ts"]
TuneExecute --> Verify["tune-verify.ts"]
TuneExecute --> Update["update.ts"]
TuneExecute --> Validate["validate-adapter-markdown-size.ts"]
TuneExecute --> Guard["protected-space-write-guard.ts"]
TuneExecute --> Messages["tune-messages.ts"]
CacheInvalidation --> RedisCache["redis-cache.ts"]
Verify --> RedisCache
Http["http-api-update.ts"] --> TuneExecute
Http --> TuneSchema
```

**Diagram sources**
- [tune.ts:1-10](file://src/tools/tune.ts#L1-L10)
- [tune-execute.ts:1-14](file://src/tools/tune-execute.ts#L1-L14)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)
- [redis-cache.ts:1-150](file://src/services/redis-cache.ts#L1-L150)
- [http-api-update.ts:1-6](file://src/http/http-api-update.ts#L1-L6)

**Section sources**
- [tune.ts:1-10](file://src/tools/tune.ts#L1-L10)
- [tune-execute.ts:1-14](file://src/tools/tune-execute.ts#L1-L14)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)
- [redis-cache.ts:1-150](file://src/services/redis-cache.ts#L1-L150)
- [http-api-update.ts:1-6](file://src/http/http-api-update.ts#L1-L6)

## Performance Considerations
- Single-pass validation for Markdown size reduces overhead.
- Batch-like processing per URI with minimal branching improves throughput.
- Prefer content arrays aligned with uris to avoid repeated parsing.
- Use layer URIs for targeted updates to minimize write volume.
- **Updated**: Cache invalidation operations are optimized for bulk processing with bounded TTL to prevent cache storms.
- **Updated**: Memory store dependencies enable efficient cache operations without external network calls.

## Troubleshooting Guide
Common issues and resolutions:
- Invalid input schema:
  - Ensure uris is non-empty and content length matches uris when provided.
  - Provide at least one of content, updates, or space.
- Protected space errors:
  - Move to a personal or allowed group space before tuning.
- Size limit violations:
  - Reduce total bytes or line lengths; respect per-line and total size caps.
- Structural changes:
  - Use Train Tool with force_update for H1 changes or layer count adjustments.
- Space reassignment failures:
  - Verify target space is allowed and reachable; retry after correcting permissions.
- **Updated**: Cache invalidation failures:
  - Check Redis connectivity and TTL configuration.
  - Verify cache keys are properly formatted and accessible.
  - Monitor cache invalidation logs for specific failure points.
- **Updated**: Post-write verification errors:
  - Retry verification after cache invalidation completes.
  - Check for concurrent access conflicts during verification.
  - Review cache consistency across distributed nodes.

**Section sources**
- [tune_schema.ts:24-40](file://src/tools/tune_schema.ts#L24-L40)
- [protected-space-write-guard.ts:13-16](file://src/utils/protected-space-write-guard.ts#L13-L16)
- [validate-adapter-markdown-size.ts:33-108](file://src/services/memory/validate-adapter-markdown-size.ts#L33-L108)
- [workflow-tune.md:108-114](file://docs/architecture/workflow-tune.md#L108-L114)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)

## Conclusion
The Tune Tool provides a safe, schema-driven mechanism for in-place adapter and layer updates, with strong validation, protective guards, clear messaging, and comprehensive cache management. The enhanced cache invalidation system ensures data consistency across distributed components, while post-write verification maintains system reliability. It complements the Train Tool for structural changes and integrates seamlessly with the HTTP API and MCP tooling. By following the documented workflows and safeguards, teams can iteratively improve protocols collaboratively and reliably with guaranteed cache consistency.

## Appendices

### Practical Workflows and Examples
- Iterative protocol improvement:
  - Export adapter or layer content, edit locally, and apply with Tune.
  - Use space to move layers after updates for organizational clarity.
  - **Updated**: Cache invalidation automatically handles distributed cache consistency.
- Change approval process:
  - Validate Markdown size and frontmatter version prior to Tune.
  - Gate space moves with permission checks.
  - **Updated**: Verify cache consistency after approval for critical systems.
- Rollback mechanisms:
  - Reassign layers back to previous spaces.
  - Re-apply previously exported content via Tune to revert changes.
  - **Updated**: Cache invalidation supports immediate rollback with proper cleanup.
- **Updated**: Distributed system workflows:
  - Coordinate cache invalidation across multiple service instances.
  - Monitor cache TTL and invalidation events for system health.
  - Implement cache warming strategies for frequently accessed adapters.

**Section sources**
- [workflow-tune.md:100-105](file://docs/architecture/workflow-tune.md#L100-L105)
- [tune.md:12-22](file://src/embed-docs/tools/tune.md#L12-L22)
- [tune-cache-invalidation.ts:1-100](file://src/tools/tune-cache-invalidation.ts#L1-L100)
- [tune-verify.ts:1-80](file://src/tools/tune-verify.ts#L1-L80)