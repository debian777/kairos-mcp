import { z } from 'zod';

const layerUriSchema = z
  .string()
  .regex(
    /^kairos:\/\/layer\/[0-9a-f-]{36}(?:\?execution_id=[0-9a-f-]{36})?$/i,
    'must match kairos://layer/{uuid}[?execution_id={uuid}]'
  );

export const rewardInputSchema = z.object({
  uri: layerUriSchema.describe('URI of the final layer in the adapter execution'),
  outcome: z.enum(['success', 'failure']).describe('Execution outcome'),
  score: z.number().min(0).max(1).optional().describe('Optional normalized reward score'),
  feedback: z.string().min(1).optional().describe('Optional evaluator feedback'),
  rater: z.string().optional().describe('Optional identifier for the evaluator'),
  rubric_version: z.string().optional().describe('Optional rubric or policy version'),
  llm_model_id: z.string().optional().describe('Optional model identifier for attribution')
});

export const rewardOutputSchema = z.object({
  results: z.array(z.object({
    uri: layerUriSchema,
    outcome: z.enum(['success', 'failure']),
    score: z.number().nullable(),
    feedback: z.string().nullable(),
    rater: z.string().nullable(),
    rubric_version: z.string().nullable(),
    rated_at: z.string()
  })),
  total_rated: z.number(),
  total_failed: z.number()
}).strict();

export type RewardInput = z.infer<typeof rewardInputSchema>;
export type RewardOutput = z.infer<typeof rewardOutputSchema>;

