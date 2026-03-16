import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

export const mintInputSchema = z.object({
  markdown_doc: z.string().min(1).describe('Markdown document to store'),
  llm_model_id: z.string().min(1).describe('LLM model ID'),
  force_update: z.boolean().optional().default(false).describe('Overwrite existing memory chain with the same label'),
  protocol_version: z.string().optional().describe('Protocol version (e.g. semver). Overrides or supplies version when document has no frontmatter.'),
  space: z.union([z.literal('personal'), z.string()]).optional().describe('Target space: "personal" (default) or group name to mint into that group space')
});

export const mintOutputSchema = z.object({
  items: z.array(z.object({
    uri: memoryUriSchema,
    memory_uuid: z.string(),
    label: z.string(),
    tags: z.array(z.string())
  })),
  status: z.literal('stored')
});

export type MintInput = z.infer<typeof mintInputSchema>;
export type MintOutput = z.infer<typeof mintOutputSchema>;
