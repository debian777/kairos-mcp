import { z } from 'zod';

export const spacesInputSchema = z.object({
  include_adapter_titles: z.boolean().optional().default(false).describe('If true, include for each space a list of adapters with title and layer_count')
});

const adapterInfoSchema = z.object({
  adapter_id: z.string(),
  title: z.string(),
  layer_count: z.number()
});

const spaceInfoSchema = z.object({
  name: z.string(),
  space_id: z.string(),
  type: z.enum(['personal', 'group', 'app', 'other']),
  adapter_count: z.number(),
  adapters: z.array(adapterInfoSchema).optional()
});

export const spacesOutputSchema = z.object({
  spaces: z.array(spaceInfoSchema)
}).strict();
