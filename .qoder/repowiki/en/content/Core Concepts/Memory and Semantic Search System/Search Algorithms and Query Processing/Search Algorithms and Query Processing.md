# Search Algorithms and Query Processing

<cite>
**Referenced Files in This Document**
- [search.ts](file://src/tools/search.ts)
- [search_schema.ts](file://src/tools/search_schema.ts)
- [search_output.ts](file://src/tools/search_output.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [store-title-similarity-search.ts](file://src/services/memory/store-title-similarity-search.ts)
- [activation-search-fields.ts](file://src/services/memory/activation-search-fields.ts)
- [qdrant-query-utils.ts](file://src/utils/qdrant-query-utils.ts)
- [qdrant-vector-types.ts](file://src/utils/qdrant-vector-types.ts)
- [qdrant-collection-utils.ts](file://src/utils/qdrant-collection-utils.ts)
- [http-api-routes.ts](file://src/http/http-api-routes.ts)
- [cli-search.ts](file://src/cli/commands/search.ts)
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
This document explains the search algorithms and query processing pipeline used to retrieve relevant artifacts from memory stores. It covers hybrid search combining BM25 keyword matching with vector similarity scoring, query construction, ranking, result aggregation, title similarity search, activation-based filtering, field-specific strategies, complex queries, pagination, optimization, index usage, performance tuning, result formatting, relevance scoring, and debugging techniques.

## Project Structure
The search system spans multiple layers:
- Tooling layer exposes CLI and HTTP interfaces for search operations.
- Memory store orchestrates retrieval across backends.
- Qdrant integration performs vector and metadata searches.
- Embedding utilities provide BM25 tokenization and text preprocessing.
- Utilities implement query building, collection management, and vector typing.

```mermaid
graph TB
subgraph "Tooling"
CLI["CLI Search Command"]
API["HTTP Routes"]
end
subgraph "Memory Layer"
MemStore["Memory Store"]
StoreMethods["Store Methods"]
TitleSim["Title Similarity Search"]
ActFields["Activation Search Fields"]
end
subgraph "Vector Backend"
QdrantSearch["Qdrant Search"]
QdrantUtils["Qdrant Query Utils"]
QdrantCollections["Qdrant Collection Utils"]
QdrantVectors["Qdrant Vector Types"]
end
subgraph "Embedding"
BM25Tok["BM25 Tokenizer"]
end
CLI --> API
API --> MemStore
MemStore --> StoreMethods
MemStore --> TitleSim
MemStore --> ActFields
StoreMethods --> QdrantSearch
QdrantSearch --> QdrantUtils
QdrantSearch --> QdrantCollections
QdrantSearch --> QdrantVectors
StoreMethods --> BM25Tok
```

**Diagram sources**
- [cli-search.ts](file://src/cli/commands/search.ts)
- [http-api-routes.ts](file://src/http/http-api-routes.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [store-title-similarity-search.ts](file://src/services/memory/store-title-similarity-search.ts)
- [activation-search-fields.ts](file://src/services/memory/activation-search-fields.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [qdrant-query-utils.ts](file://src/utils/qdrant-query-utils.ts)
- [qdrant-collection-utils.ts](file://src/utils/qdrant-collection-utils.ts)
- [qdrant-vector-types.ts](file://src/utils/qdrant-vector-types.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)

**Section sources**
- [cli-search.ts](file://src/cli/commands/search.ts)
- [http-api-routes.ts](file://src/http/http-api-routes.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [store-title-similarity-search.ts](file://src/services/memory/store-title-similarity-search.ts)
- [activation-search-fields.ts](file://src/services/memory/activation-search-fields.ts)
- [qdrant-query-utils.ts](file://src/utils/qdrant-query-utils.ts)
- [qdrant-collection-utils.ts](file://src/utils/qdrant-collection-utils.ts)
- [qdrant-vector-types.ts](file://src/utils/qdrant-vector-types.ts)

## Core Components
- Search tooling:
  - Input schema validation and output formatting ensure consistent request/response contracts.
  - CLI command provides a user-facing interface for constructing and executing queries.
- Memory store:
  - Central orchestration point that coordinates BM25 and vector search, applies filters, merges results, and paginates.
- Qdrant integration:
  - Executes vector similarity search and structured metadata filtering.
  - Builds efficient filter expressions using utility helpers.
- BM25 tokenizer:
  - Normalizes and tokenizes text for keyword matching.
- Title similarity search:
  - Specialized path for high-precision title matches.
- Activation-based filtering:
  - Restricts search scope by activation patterns or fields.

**Section sources**
- [search_schema.ts](file://src/tools/search_schema.ts)
- [search_output.ts](file://src/tools/search_output.ts)
- [cli-search.ts](file://src/cli/commands/search.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [store-title-similarity-search.ts](file://src/services/memory/store-title-similarity-search.ts)
- [activation-search-fields.ts](file://src/services/memory/activation-search-fields.ts)

## Architecture Overview
The hybrid search pipeline combines lexical (BM25) and semantic (vector) signals:
- Query parsing validates inputs and extracts keywords, filters, and pagination parameters.
- BM25 path tokenizes text and builds keyword filters.
- Vector path embeds the query and requests nearest neighbors from Qdrant with optional metadata filters.
- Results are merged and re-ranked using a combined score.
- Final results are formatted and paginated before returning.

```mermaid
sequenceDiagram
participant Client as "Client"
participant CLI as "CLI Search"
participant API as "HTTP Routes"
participant MS as "Memory Store"
participant SM as "Store Methods"
participant QS as "Qdrant Search"
participant B as "BM25 Tokenizer"
Client->>CLI : "Execute search(query, filters, page)"
CLI->>API : "Forward request"
API->>MS : "Handle search"
MS->>SM : "Build hybrid query"
SM->>B : "Tokenize keywords"
SM->>QS : "Vector search with filters"
QS-->>SM : "Vector results"
SM-->>MS : "BM25 + vector results"
MS->>MS : "Merge and re-rank"
MS-->>API : "Paginated results"
API-->>CLI : "Formatted response"
CLI-->>Client : "Results"
```

**Diagram sources**
- [cli-search.ts](file://src/cli/commands/search.ts)
- [http-api-routes.ts](file://src/http/http-api-routes.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)

## Detailed Component Analysis

### Hybrid Search Pipeline
- Query construction:
  - Extracts free-text query, field filters, space scoping, and pagination.
  - Validates constraints via schema definitions.
- BM25 keyword matching:
  - Tokenizes input text into terms suitable for lexical matching.
  - Builds structured filters for indexed fields.
- Vector similarity:
  - Generates an embedding for the query and retrieves top-k vectors.
  - Applies metadata filters to constrain the candidate set.
- Ranking and aggregation:
  - Combines BM25 and vector scores into a unified ranking.
  - Deduplicates and sorts final results.
- Pagination:
  - Supports offset/limit or cursor-based pagination depending on backend capabilities.

```mermaid
flowchart TD
Start(["Start"]) --> Parse["Parse and validate query"]
Parse --> BuildFilters["Build metadata filters"]
Parse --> Tokenize["Tokenize query for BM25"]
Tokenize --> BM25Path["Run BM25 keyword search"]
BuildFilters --> VectorPath["Run vector similarity search"]
BM25Path --> Merge["Merge results"]
VectorPath --> Merge
Merge --> Rank["Re-rank with combined score"]
Rank --> Paginate["Apply pagination"]
Paginate --> Format["Format output"]
Format --> End(["End"])
```

**Diagram sources**
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)

**Section sources**
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)

### Query Construction and Schema
- Input schema enforces:
  - Required and optional fields for query text, filters, and pagination.
  - Type safety and default values for robustness.
- Output schema defines:
  - Result shape, scoring metadata, and pagination tokens.

```mermaid
classDiagram
class SearchSchema {
+validate(input)
+defaults()
}
class SearchOutput {
+format(results)
+paginate(data, params)
}
SearchSchema <.. SearchOutput : "used by"
```

**Diagram sources**
- [search_schema.ts](file://src/tools/search_schema.ts)
- [search_output.ts](file://src/tools/search_output.ts)

**Section sources**
- [search_schema.ts](file://src/tools/search_schema.ts)
- [search_output.ts](file://src/tools/search_output.ts)

### BM25 Keyword Matching
- Tokenization strategy:
  - Normalizes text, splits into tokens, and removes noise.
- Index usage:
  - Maps tokens to indexed fields for fast lookup.
- Optimization:
  - Short-circuits when filters reduce candidate sets significantly.

```mermaid
flowchart TD
In(["Input text"]) --> Norm["Normalize text"]
Norm --> Split["Split into tokens"]
Split --> FilterTokens["Remove stop/noise tokens"]
FilterTokens --> Terms["Term list"]
Terms --> BuildFilter["Build BM25 filter expression"]
BuildFilter --> Execute["Execute lexical search"]
```

**Diagram sources**
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)

**Section sources**
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)

### Vector Similarity Search
- Embedding generation:
  - Converts query text into a vector representation.
- Retrieval:
  - Queries Qdrant for nearest neighbors with optional metadata filters.
- Scoring:
  - Returns similarity scores normalized for ranking.

```mermaid
sequenceDiagram
participant SM as "Store Methods"
participant QS as "Qdrant Search"
participant QU as "Qdrant Query Utils"
participant VT as "Qdrant Vector Types"
SM->>QS : "Request nearest neighbors"
QS->>QU : "Build filter expression"
QS->>VT : "Validate vector dimensions"
QS-->>SM : "Top-k results with scores"
```

**Diagram sources**
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [qdrant-query-utils.ts](file://src/utils/qdrant-query-utils.ts)
- [qdrant-vector-types.ts](file://src/utils/qdrant-vector-types.ts)

**Section sources**
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [qdrant-query-utils.ts](file://src/utils/qdrant-query-utils.ts)
- [qdrant-vector-types.ts](file://src/utils/qdrant-vector-types.ts)

### Title Similarity Search
- Purpose:
  - High-precision retrieval focused on title fields.
- Strategy:
  - Uses specialized logic to match titles semantically or lexically.
- Use cases:
  - Quick navigation to exact or near-exact documents.

```mermaid
flowchart TD
TIn(["Query"]) --> TitlePath["Title similarity path"]
TitlePath --> Filters["Apply title-focused filters"]
Filters --> Score["Compute title similarity score"]
Score --> Return(["Return ranked titles"])
```

**Diagram sources**
- [store-title-similarity-search.ts](file://src/services/memory/store-title-similarity-search.ts)

**Section sources**
- [store-title-similarity-search.ts](file://src/services/memory/store-title-similarity-search.ts)

### Activation-Based Filtering
- Scope control:
  - Limits search to items associated with specific activations or patterns.
- Field mapping:
  - Maps activation identifiers to searchable fields.
- Performance:
  - Reduces candidate set early to improve latency.

```mermaid
flowchart TD
AIn(["Activation IDs"]) --> Map["Map to fields"]
Map --> Apply["Apply activation filters"]
Apply --> Combined["Combine with other filters"]
Combined --> Search["Execute search"]
```

**Diagram sources**
- [activation-search-fields.ts](file://src/services/memory/activation-search-fields.ts)

**Section sources**
- [activation-search-fields.ts](file://src/services/memory/activation-search-fields.ts)

### Field-Specific Search Strategies
- Targeted fields:
  - Allows restricting search to specific attributes (e.g., title, tags).
- Weighting:
  - Adjusts importance per field during ranking.
- Examples:
  - Title-only search for precise lookups.
  - Tag-filtered search for categorical narrowing.

```mermaid
flowchart TD
FIn(["Field selection"]) --> Strategy["Select strategy"]
Strategy --> Build["Build field-aware filters"]
Build --> Rank["Adjust weights per field"]
Rank --> Out(["Field-scoped results"])
```

[No sources needed since this section describes conceptual strategies without analyzing specific files]

### Complex Queries, Filtering, and Pagination
- Complex queries:
  - Combine free-text with structured filters (spaces, tags, dates).
- Filtering conditions:
  - Support equality, range, and presence checks.
- Pagination:
  - Offset/limit or cursor-based approaches for large datasets.

```mermaid
flowchart TD
CIn(["Complex query"]) --> Validate["Validate against schema"]
Validate --> Compose["Compose filters"]
Compose --> Execute["Execute hybrid search"]
Execute --> Page["Apply pagination"]
Page --> FormatOut["Format output"]
```

**Diagram sources**
- [search_schema.ts](file://src/tools/search_schema.ts)
- [search_output.ts](file://src/tools/search_output.ts)
- [memory-store.ts](file://src/services/memory-store.ts)

**Section sources**
- [search_schema.ts](file://src/tools/search_schema.ts)
- [search_output.ts](file://src/tools/search_output.ts)
- [memory-store.ts](file://src/services/memory-store.ts)

## Dependency Analysis
The search subsystem depends on:
- Tooling interfaces (CLI and HTTP) for entry points.
- Memory store for orchestration.
- Qdrant integration for vector retrieval and filtering.
- Embedding utilities for tokenization.
- Utilities for query building and collection management.

```mermaid
graph TB
CLI["CLI Search"] --> API["HTTP Routes"]
API --> MS["Memory Store"]
MS --> SM["Store Methods"]
SM --> QS["Qdrant Search"]
SM --> B["BM25 Tokenizer"]
QS --> QU["Qdrant Query Utils"]
QS --> QC["Qdrant Collection Utils"]
QS --> V["Qdrant Vector Types"]
```

**Diagram sources**
- [cli-search.ts](file://src/cli/commands/search.ts)
- [http-api-routes.ts](file://src/http/http-api-routes.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [qdrant-query-utils.ts](file://src/utils/qdrant-query-utils.ts)
- [qdrant-collection-utils.ts](file://src/utils/qdrant-collection-utils.ts)
- [qdrant-vector-types.ts](file://src/utils/qdrant-vector-types.ts)

**Section sources**
- [cli-search.ts](file://src/cli/commands/search.ts)
- [http-api-routes.ts](file://src/http/http-api-routes.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [store-methods.ts](file://src/services/memory/store-methods.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)
- [bm25-tokenizer.ts](file://src/services/embedding/bm25-tokenizer.ts)
- [qdrant-query-utils.ts](file://src/utils/qdrant-query-utils.ts)
- [qdrant-collection-utils.ts](file://src/utils/qdrant-collection-utils.ts)
- [qdrant-vector-types.ts](file://src/utils/qdrant-vector-types.ts)

## Performance Considerations
- Index usage:
  - Prefer field-specific filters to reduce candidate sets early.
  - Leverage title similarity for high-precision, low-latency lookups.
- Query optimization:
  - Minimize free-text complexity; use structured filters where possible.
  - Avoid overly broad wildcard patterns in keyword searches.
- Vector search tuning:
  - Choose appropriate top-k to balance recall and cost.
  - Ensure vector dimension consistency to avoid runtime errors.
- Aggregation and ranking:
  - Keep merge and re-ranking lightweight; pre-sort when feasible.
- Pagination:
  - Use cursor-based pagination for deep paging to avoid expensive offsets.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Validation errors:
  - Check input schema compliance and required fields.
- No results:
  - Verify filters are not too restrictive.
  - Confirm embeddings exist for queried items.
- Slow queries:
  - Add more structured filters to narrow candidates.
  - Reduce top-k or limit result size.
- Incorrect scores:
  - Inspect normalization and weighting logic in ranking.
- Debugging:
  - Log intermediate steps: tokenization, filter composition, vector retrieval, and merge outcomes.

**Section sources**
- [search_schema.ts](file://src/tools/search_schema.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [qdrant-search.ts](file://src/services/qdrant/search.ts)

## Conclusion
The search system implements a robust hybrid approach combining BM25 keyword matching with vector similarity. By leveraging structured filters, title similarity, and activation-based scoping, it achieves both precision and recall while maintaining performance through careful index usage and query optimization. Clear schemas and output formatting ensure reliable integrations across CLI and HTTP interfaces.

## Appendices

### Example Patterns
- Title-only search:
  - Use title similarity path with minimal filters.
- Tag-filtered search:
  - Combine tag equality filters with free-text query.
- Date-range search:
  - Apply range filters alongside BM25 and vector components.
- Deep pagination:
  - Use cursor-based pagination for stable ordering and efficiency.

[No sources needed since this section provides conceptual examples]