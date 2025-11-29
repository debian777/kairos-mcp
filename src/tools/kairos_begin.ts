import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { handleBeginTool } from './kairos_begin-handler.js';

interface RegisterBeginOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

export function registerBeginTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterBeginOptions = {}) {
  const toolName = options.toolName || 'kairos_begin';
  const memoryUriSchema = z
    .string()
    .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

  const inputSchema = z.object({
    query: z.string().min(1).describe('Search query for chain heads')
  });

  const outputSchema = z.object({
    must_obey: z.boolean(),
    start_here: memoryUriSchema.optional().nullable(),
    chain_label: z.string().optional().nullable(),
    total_steps: z.number().optional().nullable(),
    protocol_status: z.string(),
    multiple_perfect_matches: z.number().optional().nullable(),
    message: z.string().optional().nullable(),
    suggestion: z.string().optional().nullable(),
    hint: z.string().optional().nullable(),
        best_match: z.object({
          uri: memoryUriSchema,
          label: z.string(),
          chain_label: z.string().optional().nullable(),
          score: z.number(),
          total_steps: z.number()
        }).optional().nullable(),
    choices: z.array(z.object({
      uri: memoryUriSchema,
      label: z.string(),
      chain_label: z.string().optional().nullable(),
      tags: z.array(z.string()).optional()
    })).optional().nullable()
  });

  structuredLogger.debug(`kairos_begin registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_begin registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Find chain heads',
      description: getToolDoc('kairos_begin'),
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const { query } = params as { query: string };
      return await handleBeginTool(toolName, memoryStore, query, options.qdrantService);
    }
  );
}