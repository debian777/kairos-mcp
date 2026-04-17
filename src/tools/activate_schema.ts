import { z } from 'zod';
import { KAIROS_SEARCH_LIMIT_CAP, KAIROS_SEARCH_LIMIT_MIN } from '../config.js';

const adapterUriSchema = z
  .string()
  .regex(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i, 'must match kairos://adapter/{uuid}');

export const activateInputSchema = z.object({
  query: z.string().min(1).describe('Activation query used to find the best matching adapter'),
  space: z
    .string()
    .optional()
    .describe('Scope results to this space: "personal", a group name, "Group: …", or your space id'),
  space_id: z.string().optional().describe('Alias for space'),
  max_choices: z
    .number()
    .int()
    .min(KAIROS_SEARCH_LIMIT_MIN)
    .max(KAIROS_SEARCH_LIMIT_CAP)
    .optional()
    .describe('Maximum adapter choices to return')
});

export const activateOutputSchema = z.object({
  must_obey: z.boolean().describe('Always true. Pick one adapter and follow next_action.'),
  message: z.string(),
  next_action: z.string().describe("Global directive: pick one choice and follow that choice's next_action."),
  /** Echo of the request query for MCP App / HTTP clients (human-facing headers). */
  query: z.string().describe('Same string as the activate input query.'),
  choices: z.array(z.object({
    uri: adapterUriSchema,
    label: z.string().describe('Display label for the adapter choice'),
    adapter_name: z.string().nullable().describe('Adapter title when this choice maps to a stored adapter'),
    activation_score: z.number().min(0).max(1).nullable().describe('Normalized 0.0-1.0 confidence for matches, null for refine/create'),
    role: z.enum(['match', 'refine', 'create']),
    tags: z.array(z.string()),
    next_action: z.string().describe('Instruction for this choice, typically a forward call'),
    adapter_version: z.string().nullable().describe('Stored adapter version when present'),
    activation_patterns: z.array(z.string()).optional().describe('Activation phrases associated with this adapter'),
    space_name: z
      .string()
      .nullable()
      .describe('Human-readable space where the adapter is stored; null for refine/create choices'),
    slug: z
      .string()
      .nullable()
      .describe(
        'Adapter routing slug when stored (use with kairos://adapter/{slug} in forward); null for refine/create or when absent'
      )
  })),
  /** Canonical path: export as `KAIROS_WORK_DIR` before running local shell challenges that reference it. */
  kairos_work_dir: z.string().optional()
}).strict();

export type ActivateInput = z.infer<typeof activateInputSchema>;
export type ActivateOutput = z.infer<typeof activateOutputSchema>;

