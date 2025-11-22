import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveChainNextStep } from '../services/chain-utils.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';

interface RegisterNextOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

export function registerKairosNextTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterNextOptions = {}) {
  const toolName = options.toolName || 'kairos_next';

  const inputSchema = z.object({
    uri: z.string().min(1).describe('URI of the current memory step')
  });

  const outputSchema = z.object({
    must_obey: z.literal(true),
    next_step: z.object({
      uri: z.string(),
      position: z.string(),
      label: z.string()
    }).nullable(),
    protocol_status: z.string()
  });

  structuredLogger.debug(`kairos_next registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_next registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Get next step in chain',
      description: getToolDoc('kairos_next'),
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const { uri } = params as { uri: string };
      const normalizedUri = (uri || '').trim();

      // Extract UUID from URI
      const uuid = normalizedUri.split('/').pop();
      if (!uuid) {
        return {
          content: [{
            type: 'text', text: JSON.stringify({
              must_obey: true,
              next_step: null,
              protocol_status: 'completed'
            })
          }],
          structuredContent: { must_obey: true, next_step: null, protocol_status: 'completed' }
        };
      }

      // Get the memory
      const memory = await memoryStore.getMemory(uuid);
      if (!memory) {
        return {
          content: [{
            type: 'text', text: JSON.stringify({
              must_obey: true,
              next_step: null,
              protocol_status: 'completed'
            })
          }],
          structuredContent: { must_obey: true, next_step: null, protocol_status: 'completed' }
        };
      }

      // Resolve next step
      const nextStep = await resolveChainNextStep(memory, options.qdrantService);

      if (!nextStep) {
        return {
          content: [{
            type: 'text', text: JSON.stringify({
              must_obey: true,
              next_step: null,
              protocol_status: 'completed'
            })
          }],
          structuredContent: { must_obey: true, next_step: null, protocol_status: 'completed' }
        };
      }

      const output = {
        must_obey: true,
        next_step: {
          uri: `kairos://mem/${nextStep.uuid}`,
          position: `${nextStep.step}/${nextStep.count}`,
          label: nextStep.label || 'Next step'
        },
        protocol_status: 'continue'
      };

      return {
        content: [{
          type: 'text', text: JSON.stringify(output)
        }],
        structuredContent: output
      };
    }
  );
}