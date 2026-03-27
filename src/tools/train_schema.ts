import { z } from 'zod';

const layerUriSchema = z
  .string()
  .regex(/^kairos:\/\/layer\/[0-9a-f-]{36}(?:\?execution_id=[0-9a-f-]{36})?$/i, 'must match kairos://layer/{uuid}');

const adapterUriSchema = z
  .string()
  .regex(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i, 'must match kairos://adapter/{uuid}');

const sourceAdapterUriSchema = z
  .string()
  .regex(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i, 'must match kairos://adapter/{uuid}')
  .describe('Optional fork source: export markdown from this adapter, then mint into target space');

export const trainInputSchema = z
  .object({
    markdown_doc: z
      .string()
      .optional()
      .describe('Adapter markdown to register; optional when source_adapter_uri supplies content'),
    llm_model_id: z.string().min(1).describe('LLM model ID'),
    force_update: z.boolean().optional().default(false).describe('Overwrite an existing adapter with the same label'),
    protocol_version: z.string().optional().describe('Adapter version (for example, semver)'),
    space: z.union([z.literal('personal'), z.string()]).optional().describe('Target space: "personal" or a group name'),
    source_adapter_uri: sourceAdapterUriSchema.optional().describe(
      'Fork from an existing adapter (personal/group copy); optional markdown_doc overrides exported body'
    )
  })
  .superRefine((value, ctx) => {
    const md = typeof value.markdown_doc === 'string' ? value.markdown_doc.trim() : '';
    const src = typeof value.source_adapter_uri === 'string' ? value.source_adapter_uri.trim() : '';
    if (md.length === 0 && !src) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['markdown_doc'],
        message: 'Provide markdown_doc and/or source_adapter_uri'
      });
    }
  });

export const trainOutputSchema = z.object({
  items: z.array(z.object({
    uri: layerUriSchema,
    layer_uuid: z.string(),
    adapter_uri: adapterUriSchema,
    label: z.string(),
    tags: z.array(z.string())
  })),
  status: z.literal('stored')
}).strict();

export type TrainInput = z.infer<typeof trainInputSchema>;
export type TrainOutput = z.infer<typeof trainOutputSchema>;

