import { z } from 'zod';
import { qdrantService as qdrantServiceSingleton } from '../services/qdrant/index.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

// Removed legacy registerUpdateTool (no backward compatibility)

// Simple KAIROS update tool focused on cache correctness
export function registerKairosUpdateTool(server: any, toolName = 'kairos_update') {
    const qdrantService = qdrantServiceSingleton;
    const memoryUriSchema = z
        .string()
        .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');
    server.registerTool(
        toolName,
        {
            title: 'Update KAIROS Memory(s)',
            description: getToolDoc('kairos_update'),
            inputSchema: z.object({
                uris: z.array(memoryUriSchema).nonempty().describe('Non-empty array of kairos://mem/{uuid} URIs to update'),
                markdown_doc: z.array(z.string().min(1)).optional().describe('Array of Markdown BODY or full KAIROS render; BODY will be extracted and stored for each URI'),
                updates: z.record(z.string(), z.any()).optional().describe('Advanced field updates; prefer markdown_doc for content changes')
            }),
            outputSchema: z.object({
                results: z.array(z.object({
                    uri: memoryUriSchema,
                    status: z.enum(['updated', 'error']),
                    message: z.string()
                })),
                total_updated: z.number(),
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
                const uris = params?.uris;
                const markdownDoc: string[] | undefined = params.markdown_doc;
                const updates: Record<string, any> | undefined = params.updates;

                if (!Array.isArray(uris) || uris.length === 0) {
                    throw new Error('uris must be a non-empty array of strings');
                }

            const results: any[] = [];
            let totalUpdated = 0;
            let totalFailed = 0;

            if (markdownDoc && markdownDoc.length !== uris.length) {
                throw new Error('markdown_doc array length must match uris array length');
            }

            for (let i = 0; i < uris.length; i++) {
                const uri = uris[i];
                try {
                    // Extract UUID from URI
                    const uuid = typeof uri === 'string' ? uri.split('/').pop() : undefined;
                    if (!uuid) {
                        throw new Error('Invalid URI format');
                    }

                    // Prefer markdown_doc path: extract BODY if markers present
                    const mk = Array.isArray(markdownDoc) ? markdownDoc[i] : undefined;
                    if (typeof mk === 'string' && mk.trim().length > 0) {
                        const body = extractBody(mk);
                        await qdrantService.updateMemory(uuid, { text: body });
                    } else if (updates && Object.keys(updates).length > 0) {
                        // Back-compat path: if updates.text seems to contain a full KAIROS HTML render
                        // (<!-- KAIROS:BODY-START --> markers), extract the BODY and apply it as a plain 'text' update.
                        if (typeof updates['text'] === 'string' && updates['text'].indexOf('<!-- KAIROS:BODY-START') !== -1 && updates['text'].indexOf('<!-- KAIROS:BODY-END') !== -1) {
                            const body = extractBody(updates['text']);
                            // Only update the 'text' field to ensure header/footer are untouched
                            await qdrantService.updateMemory(uuid, { text: body });
                        } else {
                            // If no KB markers found, forward raw updates as-is (back-compat behavior)
                            await qdrantService.updateMemory(uuid, updates);
                        }
                    } else {
                        throw new Error('Provide markdown_doc or updates');
                    }

                    results.push({
                        uri,
                        status: 'updated' as const,
                        message: `Memory ${uri} updated successfully`
                    });
                    totalUpdated++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.push({
                        uri,
                        status: 'error' as const,
                        message: `Failed to update memory: ${errorMessage}`
                    });
                    totalFailed++;
                }
            }

            result = {
                results,
                total_updated: totalUpdated,
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

// Extract BODY from a full KAIROS render if present; otherwise return input as-is
function extractBody(text: string): string {
    const start = /<!--\s*KAIROS:BODY-START\s*-->/i;
    const end = /<!--\s*KAIROS:BODY-END\s*-->/i;
    const s = text.search(start);
    const e = text.search(end);
    if (s >= 0 && e > s) {
        // slice between the end of start marker and beginning of end marker
        const startMatch = text.match(start);
        if (!startMatch) return text;
        const startIdx = (startMatch.index || 0) + startMatch[0].length;
        return text.slice(startIdx, e).trim();
    }
    return text;
}
