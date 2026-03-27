import { z } from 'zod';

export const spacesInputSchema = z.object({
  include_adapter_titles: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, include for each space a list of adapters with title and layer_count'),
  include_widget_html: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, append an HTML table (second content part) with space types and expandable adapter rows; implies adapter titles are loaded'
    )
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
