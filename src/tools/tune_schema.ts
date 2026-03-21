import { z } from 'zod';

const tuneUriSchema = z
  .string()
  .regex(/^kairos:\/\/(adapter|layer)\/[0-9a-f-]{36}(?:\?execution_id=[0-9a-f-]{36})?$/i, 'must match kairos://adapter/{uuid} or kairos://layer/{uuid}');

export const tuneInputSchema = z
  .object({
    uris: z.array(tuneUriSchema).nonempty().describe('Non-empty array of adapter or layer URIs to update'),
    markdown_doc: z.array(z.string().min(1)).optional().describe('Updated adapter markdown bodies'),
    updates: z.record(z.string(), z.any()).optional().describe('Advanced field updates; prefer markdown_doc for content changes')
  })
  .superRefine((value, ctx) => {
    if (value.markdown_doc && value.markdown_doc.length !== value.uris.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['markdown_doc'],
        message: 'markdown_doc must have the same number of entries as uris'
      });
    }
    if (!value.markdown_doc && !value.updates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['markdown_doc'],
        message: 'Provide markdown_doc or updates'
      });
    }
  });

export const tuneOutputSchema = z.object({
  results: z.array(z.object({
    uri: tuneUriSchema,
    status: z.enum(['updated', 'error']),
    message: z.string()
  })),
  total_updated: z.number(),
  total_failed: z.number()
}).strict();

export type TuneInput = z.infer<typeof tuneInputSchema>;
export type TuneOutput = z.infer<typeof tuneOutputSchema>;

