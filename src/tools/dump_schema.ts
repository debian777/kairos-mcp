import { z } from 'zod';

const positionSchema = z.object({
  step_index: z.number(),
  step_count: z.number()
});

/** Output shape for single-step dump (no protocol=true). */
export const dumpOutputSchema = z.object({
  markdown_doc: z.string(),
  uri: z.string(),
  label: z.string(),
  chain_label: z.string().nullable(),
  step_count: z.number().optional(),
  slug: z.string().optional().describe('Protocol routing slug when protocol=true'),
  protocol_version: z.string().optional(),
  position: positionSchema.optional(),
  challenge: z.record(z.string(), z.unknown()).optional()
}).strict();

export type DumpOutput = z.infer<typeof dumpOutputSchema>;
