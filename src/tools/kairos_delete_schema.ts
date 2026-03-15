import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

export const deleteInputSchema = z.object({
  uris: z
    .array(memoryUriSchema)
    .nonempty()
    .describe('Non-empty array of kairos://mem/{uuid} URIs to delete')
});

export const deleteOutputSchema = z.object({
  results: z.array(z.object({
    uri: memoryUriSchema,
    status: z.enum(['deleted', 'error']),
    message: z.string()
  })),
  total_deleted: z.number(),
  total_failed: z.number()
}).strict();

export type DeleteInput = z.infer<typeof deleteInputSchema>;
export type DeleteOutput = z.infer<typeof deleteOutputSchema>;
