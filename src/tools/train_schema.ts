import { z } from 'zod';

const adapterUriSchema = z
  .string()
  .regex(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i, 'must match kairos://adapter/{uuid}');

const sourceAdapterUriSchema = z
  .string()
  .regex(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i, 'must match kairos://adapter/{uuid}')
  .describe('Optional fork source: export markdown from this adapter, then train into target space');

export const trainInputSchema = z
  .object({
    content: z
      .string()
      .optional()
      .describe(
        'Content to store. For adapters: protocol markdown. For artifacts: script/config source. Format determined by mime parameter.'
      ),
    llm_model_id: z.string().min(1).describe('LLM model ID'),
    force_update: z.boolean().optional().default(false).describe('Overwrite an existing adapter with the same label'),
    protocol_version: z.string().optional().describe('Adapter version (for example, semver)'),
    space: z.union([z.literal('personal'), z.string()]).optional().describe('Target space: "personal" or a group name'),
    source_adapter_uri: sourceAdapterUriSchema.optional().describe(
      'Fork from an existing adapter (personal/group copy); optional content overrides exported body'
    ),
    mime: z
      .string()
      .optional()
      .describe(
        'Content MIME type. Omit or set "text/markdown" for adapters. Use text/x-python, text/x-shellscript, etc. for artifacts.'
      ),
    artifact_name: z
      .string()
      .optional()
      .describe('Required when mime is non-markdown. Human-readable artifact name.')
    ,
    adapter_uri: adapterUriSchema
      .optional()
      .describe('Attach artifact to an existing adapter. Required when mime is non-markdown.')
  })
  .superRefine((value, ctx) => {
    const md = typeof value.content === 'string' ? value.content.trim() : '';
    const src = typeof value.source_adapter_uri === 'string' ? value.source_adapter_uri.trim() : '';
    if (md.length === 0 && !src) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content'],
        message: 'Provide content and/or source_adapter_uri'
      });
    }

    const mime = typeof value.mime === 'string' ? value.mime.trim() : '';
    if (mime.length > 0 && mime !== 'text/markdown') {
      if (!value.artifact_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_name'],
          message: 'artifact_name is required when mime is non-markdown'
        });
      }
      if (!value.adapter_uri?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adapter_uri'],
          message: 'adapter_uri is required when mime is non-markdown'
        });
      }
    }
  });

export const trainOutputSchema = z.object({
  items: z.array(z.object({
    uri: z.string(),
    layer_uuid: z.string().optional(),
    artifact_uuid: z.string().optional(),
    adapter_uri: adapterUriSchema.optional(),
    label: z.string(),
    tags: z.array(z.string()),
    content_type: z.string().optional()
  })),
  status: z.literal('stored')
}).strict();

export type TrainInput = z.infer<typeof trainInputSchema>;
export type TrainOutput = z.infer<typeof trainOutputSchema>;

/** Internal: validated markdown + model for the low-level store step (after fork resolution). */
const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

export const trainStoreInputSchema = z.object({
  content: z.string().min(1).describe('Content to store'),
  llm_model_id: z.string().min(1).describe('LLM model ID'),
  force_update: z.boolean().optional().default(false).describe('Overwrite an existing adapter with the same label'),
  protocol_version: z.string().optional().describe('Protocol version (e.g. semver). Overrides or supplies version when document has no frontmatter.'),
  space: z.union([z.literal('personal'), z.string()]).optional().describe('Target space: "personal" (default) or group name to train into that group space'),
  mime: z.string().optional().describe('MIME type for content'),
  artifact_name: z.string().optional().describe('Artifact name for non-markdown content'),
  adapter_uri: adapterUriSchema.optional().describe('Target adapter URI for attached artifacts'),
  fork_new_adapter: z
    .boolean()
    .optional()
    .describe('Internal: mint new adapter id (train fork from source_adapter_uri)')
});

export const trainStoreOutputSchema = z.object({
  items: z.array(
    z.object({
      uri: memoryUriSchema,
      memory_uuid: z.string().optional(),
      layer_uuid: z.string().optional(),
      artifact_uuid: z.string().optional(),
      adapter_uri: adapterUriSchema.optional(),
      label: z.string(),
      tags: z.array(z.string()),
      content_type: z.string().optional()
    })
  ),
  status: z.literal('stored')
});

export type TrainStoreInput = z.infer<typeof trainStoreInputSchema>;
export type TrainStoreOutput = z.infer<typeof trainStoreOutputSchema>;
