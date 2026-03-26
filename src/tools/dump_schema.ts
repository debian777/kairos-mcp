import { z } from 'zod';

const positionSchema = z.object({
  layer_index: z.number(),
  layer_count: z.number()
});

/** Output shape for single-step dump (no protocol=true). */
export const dumpOutputSchema = z.object({
  markdown_doc: z.string(),
  uri: z.string(),
  label: z.string(),
  adapter_name: z.string().nullable(),
  layer_count: z.number().optional(),
  slug: z.string().optional().describe('Protocol routing slug when protocol=true'),
  adapter_version: z.string().optional(),
  position: positionSchema.optional(),
  challenge: z.record(z.string(), z.unknown()).optional()
}).strict();

export type DumpOutput = z.infer<typeof dumpOutputSchema>;
