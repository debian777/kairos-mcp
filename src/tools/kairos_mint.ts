import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { Memory } from '../types/memory.js';
import { logger } from '../utils/logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';

interface RegisterKairosMintOptions {
  toolName?: string;
}

export function registerKairosMintTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterKairosMintOptions = {}) {
  const toolName = options.toolName || 'kairos_mint';

  const inputSchema = z.object({
    markdown_doc: z.string().min(1).describe('Markdown document to store'),
    llm_model_id: z.string().min(1).describe('LLM model ID'),
    force_update: z.boolean().optional().default(false).describe('Overwrite existing memory chain with the same label')
  });

  const outputSchema = z.object({
    items: z.array(z.object({
      uri: z.string(),
      memory_uuid: z.string(),
      label: z.string(),
      tags: z.array(z.string())
    })),
    status: z.literal('stored')
  });

  logger.debug(`kairos_mint registration inputSchema: ${JSON.stringify(inputSchema)}`);
  logger.debug(`kairos_mint registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Store memory or chain',
      description: getToolDoc('kairos_mint'),
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const { markdown_doc, llm_model_id, force_update } = params as { markdown_doc: string; llm_model_id: string; force_update?: boolean };
      const docs = [markdown_doc];
      let memories: Memory[] = [];
      try {
        memories = await memoryStore.storeChain(docs, llm_model_id, { forceUpdate: !!force_update });
      } catch (error) {
        // Handle duplicate chain error explicitly
        const err = error as any;
        if (err && (err.code === 'DUPLICATE_CHAIN' || err.code === 'DUPLICATE_KEY')) {
          const body = {
            error: 'DUPLICATE_CHAIN',
            ...(err.details || {})
          };
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify(body) }]
          } as any;
        }
        logger.error(`[kairos_mint] Failed to store memory chain (len=${markdown_doc?.length || 0}, model=${llm_model_id})`, error);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'STORE_FAILED', message: err?.message || String(err) }) }]
        } as any;
      }
      const output = {
        items: memories.map(memory => ({
          uri: `kairos://mem/${memory.memory_uuid}`,
          memory_uuid: memory.memory_uuid,
          label: memory.label,
          tags: memory.tags
        })),
        status: 'stored'
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
  );
}
