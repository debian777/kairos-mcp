import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

export const attestInputSchema = z.object({
  uri: memoryUriSchema.describe('URI of the last step in the protocol'),
  outcome: z.enum(['success', 'failure']).describe('Execution outcome'),
  message: z.string().min(1).describe('Short summary of how the protocol went'),
  quality_bonus: z.number().optional().default(0).describe('Additional quality bonus to apply'),
  llm_model_id: z.string().optional().describe('Optional model identifier for attribution')
});

export const attestOutputSchema = z.object({
  results: z.array(z.object({
    uri: memoryUriSchema,
    outcome: z.string(),
    quality_bonus: z.number(),
    message: z.string(),
    rated_at: z.string()
  })),
  total_rated: z.number(),
  total_failed: z.number()
});

export type AttestInput = z.infer<typeof attestInputSchema>;
export type AttestOutput = z.infer<typeof attestOutputSchema>;
