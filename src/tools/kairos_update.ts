import { z } from 'zod';
import { qdrantService as qdrantServiceSingleton } from '../services/qdrant/index.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';

// Removed legacy registerUpdateTool (no backward compatibility)

// Simple KAIROS update tool focused on cache correctness
export function registerKairosUpdateTool(server: any, toolName = 'kairos_update') {
    const qdrantService = qdrantServiceSingleton;
    server.registerTool(
        toolName,
        {
            title: 'Update KAIROS Memory(s)',
            description: getToolDoc('kairos_update'),
            inputSchema: z.object({
                uris: z.array(z.string().min(1)).nonempty().describe('Non-empty array of kairos://mem/{uuid} URIs to update'),
                markdown_doc: z.array(z.string().min(1)).optional().describe('Array of Markdown BODY or full KAIROS render; BODY will be extracted and stored for each URI'),
                updates: z.record(z.any()).optional().describe('Advanced field updates; prefer markdown_doc for content changes')
            }),
            outputSchema: z.object({
                results: z.array(z.object({
                    uri: z.string(),
                    status: z.enum(['updated', 'error']),
                    message: z.string()
                })),
                total_updated: z.number(),
                total_failed: z.number()
            })
        },
        async (params: any) => {
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

            const result = {
                results,
                total_updated: totalUpdated,
                total_failed: totalFailed
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(result) }],
                structuredContent: result
            };
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
