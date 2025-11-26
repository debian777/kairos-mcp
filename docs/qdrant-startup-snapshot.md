# Qdrant Snapshot on Startup

This document proposes the implementation plan for taking a Qdrant collection snapshot automatically during application boot. The goal is to guarantee that every Kairos instance captures an immutable backup at the moment it becomes ready to mutate the vector store.

## Objectives
- Capture a snapshot exactly once per process start, immediately after Qdrant is reachable and the Kairos memory store finishes its initialization.
- Allow operators to turn the feature on/off via a single environment flag.
- Allow operators to control where snapshot files are persisted (inside the container or on a mounted volume) without editing code.
- Fail loudly on configuration issues (e.g., unwritable directory) but do not block the server from serving traffic if the snapshot HTTP call fails.

## Non-Goals
- Continuous or scheduled snapshots. This proposal only covers the one-time snapshot at boot.
- Restoring snapshots or rotating old backups. Those topics will be handled separately.
- Multi-tenant snapshot fan-out. We snapshot whichever collection the process already targets.

## Configuration Surface

| Variable | Default | Description |
| --- | --- | --- |
| `QDRANT_SNAPSHOT_ON_START` | `false` | Enables the boot snapshot when set to any truthy string (`true`, `1`, etc.). |
| `QDRANT_SNAPSHOT_DIR` | `./data/qdrant/snapshots` | Absolute or relative path where the downloaded snapshot file will be written. Must exist or be creatable by the process. |

Implementation details:
- Both variables will be declared in `src/config.ts`, using the existing helpers (`getEnvBoolean`, `getEnvString`).
- `QDRANT_SNAPSHOT_DIR` must resolve to an absolute path before use to avoid ambiguity with different working directories.
- When the directory does not exist, the startup routine will attempt to `mkdir -p`. If that fails, we throw an error before contacting Qdrant so operators immediately see the misconfiguration.

## Execution Flow
1. `src/index.ts` already waits for Qdrant health and initializes the memory store before injecting resources and starting transports.

```48:75:src/index.ts
async function main(): Promise<void> {
    try {
        installGlobalErrorHandlers();
        const memoryStore = new MemoryQdrantStore();
        await waitForQdrant(memoryStore);
        await memoryStore.init();
        await injectMemResourcesAtBoot(memoryStore, { force: true });
        startMetricsServer();
        const server = createServer(memoryStore);
        await startServer(server, memoryStore);
    } catch (err) {
        ...
    }
}
```

2. We will insert `await triggerStartupSnapshot()` immediately after `memoryStore.init()` and before `injectMemResourcesAtBoot()`. That ensures:
   - Qdrant has already been validated for connectivity.
   - No Kairos components have mutated the collection yet, so the snapshot represents the last known-good state before this boot.
3. `triggerStartupSnapshot` lives in a new module `src/services/qdrant/snapshots.ts` to keep the logic isolated and reusable by future jobs.
4. The function accepts both the `QdrantService` (for connection metadata) and the resolved config values so we do not rely on globals inside the module.

## Manual Snapshot Endpoint
- Expose `POST /api/snapshot` so operators can trigger the same snapshot pipeline at runtime.
- The endpoint fans out to the same helper used during startup, initially covering only Qdrant but structured to add Redis or other stores later.
- Response payload will report per-target status (`completed`, `failed`, `skipped`) plus file paths, which makes it easy to plug into automation.
- The route will always attempt Qdrant snapshots even if `QDRANT_SNAPSHOT_ON_START` is disabled; operators can still opt out globally by leaving the API unused.
- We log each invocation with `reason=api` to differentiate from startup runs.

## Interaction with Qdrant
- Qdrant exposes REST endpoints for snapshots. We will use the per-collection variant so that the snapshot is scoped to the configured collection:
  - `POST /collections/{collection}/snapshots` → returns `{ name: string }`.
  - `GET /collections/{collection}/snapshots/{name}` → streams the snapshot file.
- The `@qdrant/js-client-rest` SDK does not currently wrap snapshot APIs, so we will issue raw `fetch`/`undici` calls using the base URL/headers already present in `QdrantConnection`.
- We will download the snapshot stream to `QDRANT_SNAPSHOT_DIR/<timestamp>-<collection>.snap` using Node streams (e.g., `pipeline`).
- Snapshot names coming from Qdrant already include the collection name and timestamp; we will mirror that on disk but keep our own prefix so future cleanup logic can pattern-match files we generated.

## Error Handling & Telemetry
- Directory creation failure → throw and stop startup. This surfaces permission issues immediately.
- HTTP 4xx/5xx from Qdrant → log at `error` level with full response body, but continue booting. Operators can retry manually without killing the process.
- Download stream failure → delete the partially written file to avoid corrupt backups.
- Emit structured logs summarizing:
  - Snapshot name returned by Qdrant.
  - Final file path and byte size.
  - Duration (for future metrics; optional to wire into Prometheus later).

## Testing Strategy
- Unit: stub `fetch` to simulate snapshot creation and validate that we hit both POST and GET with the expected URLs and headers when the flag is enabled.
- Integration (optional follow-up): spin up docker-compose Qdrant, set env vars, and assert the snapshot file is created in the mounted directory.
- Negative tests: directory unwritable, POST returning 500, download stream aborting mid-way.

## Open Questions
- Should we delete previous snapshots automatically or keep every file? Initial version will keep everything; operators can prune the directory.
- Do we need to snapshot both the primary collection and any aliases? Current plan snapshots only the active collection returned by `getQdrantCollection`.

---

Next steps after doc approval:
1. Land config additions and module scaffolding.
2. Wire `triggerStartupSnapshot` into `main()` as described.
3. Add automated tests and documentation (README snippet) explaining how to enable the feature.



