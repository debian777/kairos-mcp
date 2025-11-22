import { z } from 'zod';
import { qdrantService } from '../services/qdrant/index.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';

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

            const result = {
                results,
                total_deleted: totalDeleted,
                total_failed: totalFailed
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(result) }],
                structuredContent: result
            };
        }
    );
}
