import express from "express";
import type { MemoryQdrantStore } from "../services/memory/store.js";
import { executeSpaces } from "../tools/spaces.js";
import { structuredLogger } from "../utils/structured-logger.js";

/**
 * Set up API route for spaces (list spaces and adapter counts).
 * Request body may include include_adapter_titles (boolean) to return adapters with title and layer_count per space.
 */
export function setupSpacesRoute(app: express.Express, memoryStore: MemoryQdrantStore): void {
  app.post("/api/spaces", async (req, res) => {
    try {
      structuredLogger.info("-> POST /api/spaces");
      const body = (req.body ?? {}) as { include_adapter_titles?: boolean };
      const includeAdapterTitles = Boolean(body.include_adapter_titles);
      const payload = await executeSpaces(memoryStore, { include_adapter_titles: includeAdapterTitles });
      res.status(200).json(payload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      structuredLogger.debug(`spaces HTTP error: ${message}`);
      res.status(500).json({ error: "SPACES_FAILED", message });
    }
  });
}
