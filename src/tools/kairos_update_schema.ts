import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

export const updateInputSchema = z.object({
  uris: z.array(memoryUriSchema).nonempty().describe('Non-empty array of kairos://mem/{uuid} URIs to update'),
  markdown_doc: z.array(z.string().min(1)).optional().describe('Array of Markdown BODY or full KAIROS render; BODY will be extracted and stored for each URI'),
  updates: z.record(z.string(), z.any()).optional().describe('Advanced field updates; prefer markdown_doc for content changes')
});

export const updateOutputSchema = z.object({
  results: z.array(z.object({
    uri: memoryUriSchema,
    status: z.enum(['updated', 'error']),
    message: z.string()
  })),
  total_updated: z.number(),
  total_failed: z.number()
});

export type UpdateInput = z.infer<typeof updateInputSchema>;
export type UpdateOutput = z.infer<typeof updateOutputSchema>;
