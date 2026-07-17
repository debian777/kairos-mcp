# Tool Development and Registry

<cite>
**Referenced Files in This Document**
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/tools/delete.ts](file://src/tools/delete.ts)
- [src/tools/delete_schema.ts](file://src/tools/delete_schema.ts)
- [src/tools/spaces.ts](file://src/tools/spaces.ts)
- [src/tools/spaces_schema.ts](file://src/tools/spaces_schema.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/tools/dump_schema.ts](file://src/tools/dump_schema.ts)
- [src/tools/update.ts](file://src/tools/update.ts)
- [src/tools/update_schema.ts](file://src/tools/update_schema.ts)
- [src/tools/next.ts](file://src/tools/next.ts)
- [src/tools/next_schema.ts](file://src/tools/next_schema.ts)
- [src/tools/mcp-tool-input-teaching.ts](file://src/tools/mcp-tool-input-teaching.ts)
- [src/tools/mcp-runtime-error.ts](file://src/tools/mcp-runtime-error.ts)
- [src/tools/forward-register.ts](file://src/tools/forward-register.ts)
- [src/tools/forward-helpers.ts](file://src/tools/forward-helpers.ts)
- [src/tools/forward-view.ts](file://src/tools/forward-view.ts)
- [src/tools/forward-trace.ts](file://src/tools/forward-trace.ts)
- [src/tools/forward-tool-error.ts](file://src/tools/forward-tool-error.ts)
- [src/http/http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)
- [src/utils/zod-to-jsonschema.ts](file://src/utils/zod-to-jsonschema.ts)
- [tests/integration/mcp-list-tools.test.ts](file://tests/integration/mcp-list-tools.test.ts)
- [tests/unit/mcp-tool-input-teaching.test.ts](file://tests/unit/mcp-tool-input-teaching.test.ts)
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
This document explains how tools are developed, registered, validated, executed, and observed within the system. It focuses on:
- Tool registration mechanisms and schema validation
- Input/output handling and error propagation
- Tool lifecycle, dependency injection, and service access patterns
- Testing strategies, debugging techniques, and performance profiling
- Creating custom tools with complex business logic and external integrations
- Versioning, backward compatibility, and distribution patterns

The goal is to provide a comprehensive guide for building robust, testable, and maintainable tools that integrate seamlessly with the runtime and MCP layer.

## Project Structure
Tools are implemented as modules under src/tools, each paired with a JSON Schema definition file (e.g., _schema.ts). The HTTP/MCP handler wires tool execution into the server and exposes them via MCP endpoints. Services such as memory and Qdrant are accessed through dependency injection or shared services.

```mermaid
graph TB
subgraph "HTTP/MCP Layer"
H["http-mcp-handler.ts"]
end
subgraph "Tools"
T1["tools/forward.ts"]
T2["tools/activate.ts"]
T3["tools/search.ts"]
T4["tools/export.ts"]
T5["tools/train.ts"]
T6["tools/tune.ts"]
T7["tools/reward.ts"]
T8["tools/delete.ts"]
T9["tools/spaces.ts"]
T10["tools/dump.ts"]
T11["tools/update.ts"]
T12["tools/next.ts"]
end
subgraph "Schemas"
S1["tools/forward_schema.ts"]
S2["tools/activate_schema.ts"]
S3["tools/search_schema.ts"]
S4["tools/export_schema.ts"]
S5["tools/train_schema.ts"]
S6["tools/tune_schema.ts"]
S7["tools/reward_schema.ts"]
S8["tools/delete_schema.ts"]
S9["tools/spaces_schema.ts"]
S10["tools/dump_schema.ts"]
S11["tools/update_schema.ts"]
S12["tools/next_schema.ts"]
end
subgraph "Services"
M["services/memory/store.ts"]
Q["services/qdrant/service.ts"]
end
H --> T1
H --> T2
H --> T3
H --> T4
H --> T5
H --> T6
H --> T7
H --> T8
H --> T9
H --> T10
H --> T11
H --> T12
T1 --> S1
T2 --> S2
T3 --> S3
T4 --> S4
T5 --> S5
T6 --> S6
T7 --> S7
T8 --> S8
T9 --> S9
T10 --> S10
T11 --> S11
T12 --> S12
T1 --> M
T1 --> Q
T2 --> M
T3 --> M
T4 --> M
T5 --> M
T6 --> M
T7 --> M
T8 --> M
T9 --> M
T10 --> M
T11 --> M
T12 --> M
```

**Diagram sources**
- [src/http/http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/delete.ts](file://src/tools/delete.ts)
- [src/tools/spaces.ts](file://src/tools/spaces.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/tools/update.ts](file://src/tools/update.ts)
- [src/tools/next.ts](file://src/tools/next.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/tools/delete_schema.ts](file://src/tools/delete_schema.ts)
- [src/tools/spaces_schema.ts](file://src/tools/spaces_schema.ts)
- [src/tools/dump_schema.ts](file://src/tools/dump_schema.ts)
- [src/tools/update_schema.ts](file://src/tools/update_schema.ts)
- [src/tools/next_schema.ts](file://src/tools/next_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

**Section sources**
- [src/http/http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/delete.ts](file://src/tools/delete.ts)
- [src/tools/spaces.ts](file://src/tools/spaces.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/tools/update.ts](file://src/tools/update.ts)
- [src/tools/next.ts](file://src/tools/next.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

## Core Components
- Tool modules: Each tool is a module implementing an invocation function and exporting a corresponding JSON Schema. Examples include forward, activate, search, export, train, tune, reward, delete, spaces, dump, update, next.
- Schema definitions: Paired _schema.ts files define input contracts using JSON Schema. These schemas are used for validation and documentation.
- MCP handler: The HTTP/MCP handler routes incoming requests to tool implementations, validates inputs against schemas, and returns standardized responses.
- Service access: Tools interact with domain services like memory store and Qdrant for persistence and retrieval.

Key responsibilities:
- Validate inputs against schemas before executing business logic
- Produce structured outputs conforming to expected shapes
- Propagate errors consistently to callers
- Provide observability via traces and metrics

**Section sources**
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/tools/delete.ts](file://src/tools/delete.ts)
- [src/tools/delete_schema.ts](file://src/tools/delete_schema.ts)
- [src/tools/spaces.ts](file://src/tools/spaces.ts)
- [src/tools/spaces_schema.ts](file://src/tools/spaces_schema.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/tools/dump_schema.ts](file://src/tools/dump_schema.ts)
- [src/tools/update.ts](file://src/tools/update.ts)
- [src/tools/update_schema.ts](file://src/tools/update_schema.ts)
- [src/tools/next.ts](file://src/tools/next.ts)
- [src/tools/next_schema.ts](file://src/tools/next_schema.ts)
- [src/http/http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

## Architecture Overview
The tool registry pattern centers around a central handler that discovers and invokes tools by name. Inputs are validated against JSON Schemas, then passed to tool implementations. Tools may call services for data operations and return structured results. Errors are normalized and propagated back to clients.

```mermaid
sequenceDiagram
participant Client as "MCP Client"
participant Handler as "http-mcp-handler.ts"
participant Registry as "Tool Registry"
participant Tool as "tools/<name>.ts"
participant Schema as "tools/<name>_schema.ts"
participant Store as "services/memory/store.ts"
participant Qdrant as "services/qdrant/service.ts"
Client->>Handler : "Call tool(name, params)"
Handler->>Registry : "Resolve tool by name"
Registry-->>Handler : "Tool implementation + schema"
Handler->>Schema : "Validate params"
Schema-->>Handler : "Validated params or error"
alt "Validation fails"
Handler-->>Client : "Structured error"
else "Validation passes"
Handler->>Tool : "Invoke(params)"
Tool->>Store : "Read/write memory"
Tool->>Qdrant : "Search/index vectors"
Store-->>Tool : "Result"
Qdrant-->>Tool : "Result"
Tool-->>Handler : "Structured output"
Handler-->>Client : "Response"
end
```

**Diagram sources**
- [src/http/http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

## Detailed Component Analysis

### Forward Tool
The forward tool orchestrates multi-step workflows, manages state transitions, and integrates with UI views and tracing.

```mermaid
flowchart TD
Start(["Forward Entry"]) --> Validate["Validate input against schema"]
Validate --> Valid{"Input valid?"}
Valid --> |No| Error["Return validation error"]
Valid --> |Yes| Resolve["Resolve target offering/tool"]
Resolve --> Prepare["Prepare payload and context"]
Prepare --> Execute["Execute step(s)"]
Execute --> View["Render view if needed"]
View --> Trace["Emit trace events"]
Trace --> Return["Return structured result"]
Error --> End(["Exit"])
Return --> End
```

**Diagram sources**
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/forward-helpers.ts](file://src/tools/forward-helpers.ts)
- [src/tools/forward-view.ts](file://src/tools/forward-view.ts)
- [src/tools/forward-trace.ts](file://src/tools/forward-trace.ts)
- [src/tools/forward-tool-error.ts](file://src/tools/forward-tool-error.ts)

**Section sources**
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/forward-helpers.ts](file://src/tools/forward-helpers.ts)
- [src/tools/forward-view.ts](file://src/tools/forward-view.ts)
- [src/tools/forward-trace.ts](file://src/tools/forward-trace.ts)
- [src/tools/forward-tool-error.ts](file://src/tools/forward-tool-error.ts)

### Activate Tool
The activate tool initializes sessions and prepares contexts for subsequent interactions.

```mermaid
sequenceDiagram
participant Client as "MCP Client"
participant Handler as "http-mcp-handler.ts"
participant Tool as "tools/activate.ts"
participant Schema as "tools/activate_schema.ts"
participant Store as "services/memory/store.ts"
Client->>Handler : "Call activate(params)"
Handler->>Schema : "Validate params"
Schema-->>Handler : "Validated params"
Handler->>Tool : "Invoke(params)"
Tool->>Store : "Create session/context"
Store-->>Tool : "Session ID"
Tool-->>Handler : "Activation result"
Handler-->>Client : "Response"
```

**Diagram sources**
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)

**Section sources**
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)

### Search Tool
The search tool queries memory and vector stores to retrieve relevant artifacts.

```mermaid
classDiagram
class SearchTool {
+invoke(params) Result
-validateParams(params) void
-queryMemory(params) MemoryResults
-queryVectors(params) VectorResults
}
class MemoryStore {
+search(query) Results
}
class QdrantService {
+search(query) Results
}
SearchTool --> MemoryStore : "uses"
SearchTool --> QdrantService : "uses"
```

**Diagram sources**
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

**Section sources**
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

### Export Tool
The export tool packages artifacts and metadata into bundles for distribution.

```mermaid
flowchart TD
Start(["Export Entry"]) --> Validate["Validate export parameters"]
Validate --> Build["Assemble items and metadata"]
Build --> Sanitize["Sanitize artifacts"]
Sanitize --> Compress["Compress bundle"]
Compress --> Emit["Emit telemetry and metrics"]
Emit --> Return["Return bundle reference"]
```

**Diagram sources**
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)

**Section sources**
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)

### Train Tool
The train tool ingests artifacts, computes embeddings, and updates indexes.

```mermaid
sequenceDiagram
participant Client as "MCP Client"
participant Handler as "http-mcp-handler.ts"
participant Tool as "tools/train.ts"
participant Schema as "tools/train_schema.ts"
participant Store as "services/memory/store.ts"
participant Qdrant as "services/qdrant/service.ts"
Client->>Handler : "Call train(params)"
Handler->>Schema : "Validate params"
Schema-->>Handler : "Validated params"
Handler->>Tool : "Invoke(params)"
Tool->>Store : "Persist artifacts"
Tool->>Qdrant : "Index vectors"
Qdrant-->>Tool : "Index status"
Store-->>Tool : "Persistence status"
Tool-->>Handler : "Training result"
Handler-->>Client : "Response"
```

**Diagram sources**
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

**Section sources**
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

### Tune Tool
The tune tool executes tuning jobs, verifies outcomes, and invalidates caches when necessary.

```mermaid
flowchart TD
Start(["Tune Entry"]) --> Validate["Validate tune parameters"]
Validate --> Execute["Run tuning job"]
Execute --> Verify["Verify results"]
Verify --> Invalidate["Invalidate dependent caches"]
Invalidate --> Return["Return tuning report"]
```

**Diagram sources**
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/tune-execute.ts](file://src/tools/tune-execute.ts)
- [src/tools/tune-verify.ts](file://src/tools/tune-verify.ts)
- [src/tools/tune-cache-invalidation.ts](file://src/tools/tune-cache-invalidation.ts)

**Section sources**
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/tune-execute.ts](file://src/tools/tune-execute.ts)
- [src/tools/tune-verify.ts](file://src/tools/tune-verify.ts)
- [src/tools/tune-cache-invalidation.ts](file://src/tools/tune-cache-invalidation.ts)

### Reward Tool
The reward tool records feedback and propagates rewards across related artifacts.

```mermaid
sequenceDiagram
participant Client as "MCP Client"
participant Handler as "http-mcp-handler.ts"
participant Tool as "tools/reward.ts"
participant Schema as "tools/reward_schema.ts"
participant Store as "services/memory/store.ts"
Client->>Handler : "Call reward(params)"
Handler->>Schema : "Validate params"
Schema-->>Handler : "Validated params"
Handler->>Tool : "Invoke(params)"
Tool->>Store : "Record reward"
Store-->>Tool : "Acknowledgement"
Tool-->>Handler : "Reward result"
Handler-->>Client : "Response"
```

**Diagram sources**
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)

**Section sources**
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)

### Delete, Spaces, Dump, Update, Next Tools
These tools manage resources, list spaces, dump states, update configurations, and compute next steps. They follow the same pattern: validate inputs via schemas, perform operations on services, and return structured outputs.

**Section sources**
- [src/tools/delete.ts](file://src/tools/delete.ts)
- [src/tools/delete_schema.ts](file://src/tools/delete_schema.ts)
- [src/tools/spaces.ts](file://src/tools/spaces.ts)
- [src/tools/spaces_schema.ts](file://src/tools/spaces_schema.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/tools/dump_schema.ts](file://src/tools/dump_schema.ts)
- [src/tools/update.ts](file://src/tools/update.ts)
- [src/tools/update_schema.ts](file://src/tools/update_schema.ts)
- [src/tools/next.ts](file://src/tools/next.ts)
- [src/tools/next_schema.ts](file://src/tools/next_schema.ts)

### Schema Validation and JSON Schema Utilities
Schema files define strict input contracts. A utility converts Zod schemas to JSON Schema for consistent validation and documentation.

```mermaid
flowchart TD
Start(["Schema Definition"]) --> Convert["Convert Zod to JSON Schema"]
Convert --> Register["Register schema with tool"]
Register --> Validate["Validate incoming params"]
Validate --> Pass{"Valid?"}
Pass --> |No| Error["Return validation error"]
Pass --> |Yes| Proceed["Proceed to tool execution"]
```

**Diagram sources**
- [src/utils/zod-to-jsonschema.ts](file://src/utils/zod-to-jsonschema.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/tools/delete_schema.ts](file://src/tools/delete_schema.ts)
- [src/tools/spaces_schema.ts](file://src/tools/spaces_schema.ts)
- [src/tools/dump_schema.ts](file://src/tools/dump_schema.ts)
- [src/tools/update_schema.ts](file://src/tools/update_schema.ts)
- [src/tools/next_schema.ts](file://src/tools/next_schema.ts)

**Section sources**
- [src/utils/zod-to-jsonschema.ts](file://src/utils/zod-to-jsonschema.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/tools/delete_schema.ts](file://src/tools/delete_schema.ts)
- [src/tools/spaces_schema.ts](file://src/tools/spaces_schema.ts)
- [src/tools/dump_schema.ts](file://src/tools/dump_schema.ts)
- [src/tools/update_schema.ts](file://src/tools/update_schema.ts)
- [src/tools/next_schema.ts](file://src/tools/next_schema.ts)

### Error Handling and Runtime Errors
Tools use a consistent error model to propagate failures back to clients. The runtime error type standardizes messages and codes.

```mermaid
classDiagram
class McpRuntimeError {
+code string
+message string
+details any
}
class ForwardToolError {
+context string
+recoverable boolean
}
McpRuntimeError <|-- ForwardToolError : "extends"
```

**Diagram sources**
- [src/tools/mcp-runtime-error.ts](file://src/tools/mcp-runtime-error.ts)
- [src/tools/forward-tool-error.ts](file://src/tools/forward-tool-error.ts)

**Section sources**
- [src/tools/mcp-runtime-error.ts](file://src/tools/mcp-runtime-error.ts)
- [src/tools/forward-tool-error.ts](file://src/tools/forward-tool-error.ts)

### Teaching and Guidance for Tool Inputs
A teaching utility provides guidance and examples for tool inputs, improving developer experience and reducing validation errors.

**Section sources**
- [src/tools/mcp-tool-input-teaching.ts](file://src/tools/mcp-tool-input-teaching.ts)

## Dependency Analysis
Tools depend on schemas for validation and on services for data operations. The MCP handler coordinates resolution and invocation.

```mermaid
graph TB
H["http-mcp-handler.ts"] --> R["Tool Registry"]
R --> F["tools/forward.ts"]
R --> A["tools/activate.ts"]
R --> S["tools/search.ts"]
R --> E["tools/export.ts"]
R --> Tn["tools/train.ts"]
R --> Tu["tools/tune.ts"]
R --> Rd["tools/reward.ts"]
R --> D["tools/delete.ts"]
R --> Sp["tools/spaces.ts"]
R --> Du["tools/dump.ts"]
R --> Up["tools/update.ts"]
R --> Nx["tools/next.ts"]
F --> FS["tools/forward_schema.ts"]
A --> AS["tools/activate_schema.ts"]
S --> SS["tools/search_schema.ts"]
E --> ES["tools/export_schema.ts"]
Tn --> TNS["tools/train_schema.ts"]
Tu --> Tus["tools/tune_schema.ts"]
Rd --> Rds["tools/reward_schema.ts"]
D --> DS["tools/delete_schema.ts"]
Sp --> Sps["tools/spaces_schema.ts"]
Du --> Dus["tools/dump_schema.ts"]
Up --> Ups["tools/update_schema.ts"]
Nx --> Nxs["tools/next_schema.ts"]
F --> MS["services/memory/store.ts"]
F --> QS["services/qdrant/service.ts"]
```

**Diagram sources**
- [src/http/http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/delete.ts](file://src/tools/delete.ts)
- [src/tools/spaces.ts](file://src/tools/spaces.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/tools/update.ts](file://src/tools/update.ts)
- [src/tools/next.ts](file://src/tools/next.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/tools/activate_schema.ts](file://src/tools/activate_schema.ts)
- [src/tools/search_schema.ts](file://src/tools/search_schema.ts)
- [src/tools/export_schema.ts](file://src/tools/export_schema.ts)
- [src/tools/train_schema.ts](file://src/tools/train_schema.ts)
- [src/tools/tune_schema.ts](file://src/tools/tune_schema.ts)
- [src/tools/reward_schema.ts](file://src/tools/reward_schema.ts)
- [src/tools/delete_schema.ts](file://src/tools/delete_schema.ts)
- [src/tools/spaces_schema.ts](file://src/tools/spaces_schema.ts)
- [src/tools/dump_schema.ts](file://src/tools/dump_schema.ts)
- [src/tools/update_schema.ts](file://src/tools/update_schema.ts)
- [src/tools/next_schema.ts](file://src/tools/next_schema.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

**Section sources**
- [src/http/http-mcp-handler.ts](file://src/http/http-mcp-handler.ts)
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/activate.ts](file://src/tools/activate.ts)
- [src/tools/search.ts](file://src/tools/search.ts)
- [src/tools/export.ts](file://src/tools/export.ts)
- [src/tools/train.ts](file://src/tools/train.ts)
- [src/tools/tune.ts](file://src/tools/tune.ts)
- [src/tools/reward.ts](file://src/tools/reward.ts)
- [src/tools/delete.ts](file://src/tools/delete.ts)
- [src/tools/spaces.ts](file://src/tools/spaces.ts)
- [src/tools/dump.ts](file://src/tools/dump.ts)
- [src/tools/update.ts](file://src/tools/update.ts)
- [src/tools/next.ts](file://src/tools/next.ts)
- [src/services/memory/store.ts](file://src/services/memory/store.ts)
- [src/services/qdrant/service.ts](file://src/services/qdrant/service.ts)

## Performance Considerations
- Batch operations: Prefer batching writes and reads to reduce round trips to services.
- Indexing efficiency: Optimize vector indexing and search queries; consider pre-filtering and pagination.
- Caching: Leverage cache invalidation strategies (e.g., after tuning) to avoid recomputation.
- Concurrency limits: Apply concurrency controls to prevent resource exhaustion during heavy workloads.
- Telemetry: Emit metrics and traces for critical paths to identify bottlenecks.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Validation errors: Check schema definitions and ensure inputs match expected types and constraints.
- Runtime errors: Inspect standardized error objects for codes and messages; use teaching utilities to refine inputs.
- Tracing: Use trace emissions to reconstruct execution flows and pinpoint failures.
- Integration tests: Run integration tests to verify end-to-end behavior and error paths.

**Section sources**
- [src/tools/mcp-tool-input-teaching.ts](file://src/tools/mcp-tool-input-teaching.ts)
- [src/tools/mcp-runtime-error.ts](file://src/tools/mcp-runtime-error.ts)
- [src/tools/forward-trace.ts](file://src/tools/forward-trace.ts)
- [tests/integration/mcp-list-tools.test.ts](file://tests/integration/mcp-list-tools.test.ts)
- [tests/unit/mcp-tool-input-teaching.test.ts](file://tests/unit/mcp-tool-input-teaching.test.ts)

## Conclusion
The tool development and registry system emphasizes clear contracts via JSON Schema, consistent error handling, and strong integration with services. By following the patterns outlined here—validating inputs early, returning structured outputs, emitting traces, and leveraging teaching utilities—you can build reliable tools that scale and remain maintainable.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Creating Custom Tools
- Define a new tool module under src/tools with an invoke function and a paired _schema.ts file.
- Ensure the MCP handler registers the tool and resolves it by name.
- Implement validation using the schema utility and handle errors with the runtime error model.
- Add unit and integration tests to cover happy paths, edge cases, and error scenarios.

**Section sources**
- [src/tools/forward.ts](file://src/tools/forward.ts)
- [src/tools/forward_schema.ts](file://src/tools/forward_schema.ts)
- [src/utils/zod-to-jsonschema.ts](file://src/utils/zod-to-jsonschema.ts)
- [src/tools/mcp-runtime-error.ts](file://src/tools/mcp-runtime-error.ts)
- [tests/integration/mcp-list-tools.test.ts](file://tests/integration/mcp-list-tools.test.ts)

### Versioning and Backward Compatibility
- Maintain schema versions and deprecation policies to support gradual upgrades.
- Use version checks in tool invocations to route to compatible implementations.
- Document breaking changes and migration steps in tool documentation.

[No sources needed since this section provides general guidance]

### Distribution Patterns
- Package tools as part of skill bundles or extensions.
- Provide manifests describing tool capabilities, schemas, and dependencies.
- Distribute via registries or catalogs and validate installations with integration tests.

[No sources needed since this section provides general guidance]