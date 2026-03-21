import { z } from 'zod';

const adapterOrLayerUriSchema = z
  .string()
  .regex(/^kairos:\/\/(adapter|layer)\/[0-9a-f-]{36}(?:\?execution_id=[0-9a-f-]{36})?$/i, 'must match kairos://adapter/{uuid} or kairos://layer/{uuid}');

export const exportFormatSchema = z.enum(['markdown', 'trace_jsonl', 'sft_jsonl', 'preference_jsonl']);

export const exportInputSchema = z.object({
  uri: adapterOrLayerUriSchema.describe('Adapter or layer URI to export'),
  format: exportFormatSchema.optional().default('markdown'),
  include_reward: z.boolean().optional().default(true).describe('Include reward fields when present')
});

export const exportOutputSchema = z.object({
  uri: adapterOrLayerUriSchema,
  format: exportFormatSchema,
  content_type: z.string(),
  content: z.string(),
  item_count: z.number().optional(),
  adapter_name: z.string().nullable().optional(),
  adapter_version: z.string().nullable().optional()
}).strict();

export type ExportInput = z.infer<typeof exportInputSchema>;
export type ExportOutput = z.infer<typeof exportOutputSchema>;

