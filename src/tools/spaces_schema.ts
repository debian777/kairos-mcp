import { z } from 'zod';

export const spacesInputSchema = z.object({
  include_chain_titles: z.boolean().optional().default(false).describe('If true, include for each space a list of chains with title and step_count')
});

const chainInfoSchema = z.object({
  chain_id: z.string(),
  title: z.string(),
  step_count: z.number()
});

const spaceInfoSchema = z.object({
  name: z.string(),
  chain_count: z.number(),
  chains: z.array(chainInfoSchema).optional()
});

export const spacesOutputSchema = z.object({
  spaces: z.array(spaceInfoSchema)
}).strict();
