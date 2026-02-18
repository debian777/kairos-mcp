import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { Memory } from '../types/memory.js';
import { logger } from '../utils/logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize, kairosMintSimilarMemoryFound } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

interface RegisterKairosMintOptions {
  toolName?: string;
}

export function registerKairosMintTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterKairosMintOptions = {}) {
  const toolName = options.toolName || 'kairos_mint';
  const memoryUriSchema = z
    .string()
    .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

  const inputSchema = z.object({
    markdown_doc: z.string().min(1).describe('Markdown document to store'),
    llm_model_id: z.string().min(1).describe('LLM model ID'),
    force_update: z.boolean().optional().default(false).describe('Overwrite existing memory chain with the same label')
  });

  const outputSchema = z.object({
    items: z.array(z.object({
      uri: memoryUriSchema,
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
      const tenantId = getTenantId();
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      
      const timer = mcpToolDuration.startTimer({ 
        tool: toolName,
        tenant_id: tenantId 
      });
      
      let result: any;
      
      try {
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
            result = {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify(body) }]
            } as any;
            mcpToolCalls.inc({ 
              tool: toolName, 
              status: 'error',
              tenant_id: tenantId 
            });
            mcpToolErrors.inc({ 
              tool: toolName, 
              status: 'error',
              tenant_id: tenantId 
            });
            timer({ 
              tool: toolName, 
              status: 'error',
              tenant_id: tenantId 
            });
            return result;
          }
          // Handle similar memory found by title (spec: must_obey, next_action, content_preview)
          if (err && err.code === 'SIMILAR_MEMORY_FOUND') {
            kairosMintSimilarMemoryFound.inc({ transport: 'mcp', tenant_id: tenantId });
            const d = err.details || {};
            const body = {
              error: 'SIMILAR_MEMORY_FOUND',
              existing_memory: d.existing_memory,
              similarity_score: d.similarity_score,
              message: d.message ?? 'A very similar memory already exists. Verify it before overwriting.',
              must_obey: d.must_obey ?? true,
              next_action: d.next_action,
              ...(d.content_preview !== undefined && { content_preview: d.content_preview })
            };
            result = {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify(body) }]
            } as any;
            mcpToolCalls.inc({ 
              tool: toolName, 
              status: 'error',
              tenant_id: tenantId 
            });
            mcpToolErrors.inc({ 
              tool: toolName, 
              status: 'error',
              tenant_id: tenantId 
            });
            timer({ 
              tool: toolName, 
              status: 'error',
              tenant_id: tenantId 
            });
            return result;
          }
          logger.error(`[kairos_mint] Failed to store memory chain (len=${markdown_doc?.length || 0}, model=${llm_model_id})`, error);
          result = {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'STORE_FAILED', message: err?.message || String(err) }) }]
          } as any;
          mcpToolCalls.inc({ 
            tool: toolName, 
            status: 'error',
            tenant_id: tenantId 
          });
          mcpToolErrors.inc({ 
            tool: toolName, 
            status: 'error',
            tenant_id: tenantId 
          });
          timer({ 
            tool: toolName, 
            status: 'error',
            tenant_id: tenantId 
          });
          return result;
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
        result = {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output
        };
        
        // Track success
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        // Track output size
        const outputSize = JSON.stringify(result).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        return result;
      } catch (error) {
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        mcpToolErrors.inc({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        timer({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        throw error;
      }
    }
  );
}
