import { z } from 'zod';

export const dumpInputSchema = z.object({
  uri: z.string().min(1).describe('kairos://mem/{uuid}'),
  protocol: z.boolean().optional().default(false).describe('If true, return full chain as one markdown document')
});

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

export type DumpInput = z.infer<typeof dumpInputSchema>;
export type DumpOutput = z.infer<typeof dumpOutputSchema>;
