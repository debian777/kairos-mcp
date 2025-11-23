import { z } from 'zod';
import { qdrantService } from '../services/qdrant/index.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

export function registerKairosDeleteTool(server: any, toolName = 'kairos_delete') {
    server.registerTool(
        toolName,
        {
            title: 'Delete KAIROS Memory',
            description: getToolDoc('kairos_delete'),
            inputSchema: z.object({
                uris: z
                    .array(z.string().min(1))
                    .nonempty()
                    .describe('Non-empty array of kairos://mem/{uuid} URIs to delete')
            }),
            outputSchema: z.object({
                results: z.array(z.object({
                    uri: z.string(),
                    status: z.enum(['deleted', 'error']),
                    message: z.string()
                })),
                total_deleted: z.number(),
                total_failed: z.number()
            })
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
                const { uris } = params || {};
                if (!Array.isArray(uris) || uris.length === 0) {
                    throw new Error('uris must be a non-empty array of strings');
                }
                const uriArray: string[] = uris;

            const results: any[] = [];
            let totalDeleted = 0;
            let totalFailed = 0;

            for (const uri of uriArray) {
                try {
                    const uuid = typeof uri === 'string' ? uri.split('/').pop() : undefined;
                    if (!uuid) {
                        throw new Error('Invalid URI format');
                    }

                    await qdrantService.deleteMemory(uuid);

                    results.push({
                        uri,
                        status: 'deleted' as const,
                        message: `Memory ${uri} deleted successfully`
                    });
                    totalDeleted++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.push({
                        uri,
                        status: 'error' as const,
                        message: `Failed to delete memory: ${errorMessage}`
                    });
                    totalFailed++;
                }
            }

            result = {
                results,
                total_deleted: totalDeleted,
                total_failed: totalFailed
            };

            const finalResult = {
                content: [{ type: 'text', text: JSON.stringify(result) }],
                structuredContent: result
            };
            
            mcpToolCalls.inc({ 
              tool: toolName, 
              status: 'success',
              tenant_id: tenantId 
            });
            
            const outputSize = JSON.stringify(finalResult).length;
            mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
            
            timer({ 
              tool: toolName, 
              status: 'success',
              tenant_id: tenantId 
            });
            
            return finalResult;
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
