import { z } from 'zod';

const deleteUriSchema = z
  .string()
  .regex(/^kairos:\/\/(adapter|layer)\/[0-9a-f-]{36}(?:\?execution_id=[0-9a-f-]{36})?$/i, 'must match kairos://adapter/{uuid} or kairos://layer/{uuid}');

export const deleteInputSchema = z.object({
  uris: z
    .array(deleteUriSchema)
    .nonempty()
    .describe('Non-empty array of adapter or layer URIs to delete')
});

export const deleteOutputSchema = z.object({
  results: z.array(z.object({
    uri: deleteUriSchema,
    status: z.enum(['deleted', 'error']),
    message: z.string()
  })),
  total_deleted: z.number(),
  total_failed: z.number()
}).strict();

export type DeleteInput = z.infer<typeof deleteInputSchema>;
export type DeleteOutput = z.infer<typeof deleteOutputSchema>;
