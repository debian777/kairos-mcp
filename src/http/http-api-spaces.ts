import express from "express";
import type { MemoryQdrantStore } from "../services/memory/store.js";
import { executeSpaces } from "../tools/kairos_spaces.js";
import { structuredLogger } from "../utils/structured-logger.js";

/**
 * Set up API route for kairos_spaces (list spaces and protocol counts).
 * Request body may include include_chain_titles (boolean) to return chains with title and step_count per space.
 */
export function setupSpacesRoute(app: express.Express, memoryStore: MemoryQdrantStore): void {
  app.post("/api/kairos_spaces", async (req, res) => {
    const startTime = Date.now();
    try {
      structuredLogger.info("-> POST /api/kairos_spaces");
      const body = (req.body ?? {}) as { include_chain_titles?: boolean };
      const includeChainTitles = Boolean(body.include_chain_titles);
      const payload = await executeSpaces(memoryStore, { include_chain_titles: includeChainTitles });
      const duration = Date.now() - startTime;
      res.status(200).json({ ...payload, metadata: { duration_ms: duration } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      structuredLogger.debug(`kairos_spaces HTTP error: ${message}`);
      res.status(500).json({ error: "SPACES_FAILED", message });
    }
  });
}
