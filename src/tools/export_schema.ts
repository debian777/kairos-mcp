import { z } from 'zod';
import { ADAPTER_URI_INPUT_REGEX, ARTIFACT_URI_INPUT_REGEX, LAYER_URI_INPUT_REGEX } from './kairos-uri.js';

const adapterUriSchema = z
  .string()
  .regex(ADAPTER_URI_INPUT_REGEX, 'must match kairos://adapter/{uuid|slug}');

const layerUriSchema = z
  .string()
  .regex(LAYER_URI_INPUT_REGEX, 'must match kairos://layer/{uuid}[?execution_id={uuid}]');

const artifactUriSchema = z
  .string()
  .regex(ARTIFACT_URI_INPUT_REGEX, 'must match kairos://artifact/{uuid|slug}');

const adapterOrLayerUriSchema = z.union([adapterUriSchema, layerUriSchema, artifactUriSchema]);

export const exportFormatSchema = z.enum([
  'markdown',
  'trace_jsonl',
  'reward_jsonl',
  'sft_jsonl',
  'preference_jsonl',
  'source'
]);

export const exportInputSchema = z.object({
  uri: adapterOrLayerUriSchema.describe('Adapter or layer URI to export'),
  format: exportFormatSchema.optional().default('markdown'),
  include_reward: z.boolean().optional().default(true).describe('Include reward fields when present')
});

const spaceTypeSchema = z.enum(['personal', 'group', 'app', 'other']);

export const exportOutputSchema = z.object({
  uri: adapterOrLayerUriSchema,
  format: exportFormatSchema,
  content_type: z.string(),
  content: z.string(),
  item_count: z.number().optional(),
  adapter_name: z.string().nullable().optional(),
  adapter_version: z.string().nullable().optional(),
  /** Present for markdown adapter exports when the layer payload includes space_id. */
  space_id: z.string().nullable().optional(),
  space_name: z.string().nullable().optional(),
  space_type: spaceTypeSchema.optional()
}).strict();

export type ExportInput = z.infer<typeof exportInputSchema>;
export type ExportOutput = z.infer<typeof exportOutputSchema>;

