import { z } from 'zod';
import { KAIROS_SEARCH_LIMIT_CAP, KAIROS_SEARCH_LIMIT_MIN } from '../config.js';

const adapterUriSchema = z
  .string()
  .regex(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i, 'must match kairos://adapter/{uuid}');

const choiceUriSchema = adapterUriSchema;

export const searchInputSchema = z.object({
  query: z.string().min(1).describe('Search query for chain heads'),
  space: z.string().optional().describe('Scope results to this space (must be in your allowed spaces)'),
  space_id: z.string().optional().describe('Alias for space'),
  max_choices: z
    .number()
    .int()
    .min(KAIROS_SEARCH_LIMIT_MIN)
    .max(KAIROS_SEARCH_LIMIT_CAP)
    .optional()
    .describe('Max match choices to return. Omit for server default; use higher for broad/vague queries.')
});

export const searchOutputSchema = z.object({
  must_obey: z.boolean().describe('Always true. Follow next_action.'),
  message: z.string().describe('Human-readable summary'),
  next_action: z.string().describe("Global directive: pick one choice and follow that choice's next_action."),
  choices: z.array(z.object({
    uri: choiceUriSchema,
    label: z.string(),
    chain_label: z.string().nullable(),
    score: z.number().nullable().describe('0.0-1.0 for matches, null for refine/create'),
    role: z.enum(['match', 'refine', 'create']).describe('match = search result, refine = search again, create = system action'),
    tags: z.array(z.string()),
    next_action: z.string().describe('Instruction for this choice.'),
    protocol_version: z.string().nullable().describe('Stored protocol version (e.g. semver) for match choices; null for refine/create. Compare with skill-bundled protocol to decide if re-mint is needed.'),
    activation_patterns: z.array(z.string()).optional().describe('Activation phrases associated with this adapter')
  })).describe('Options: match(es) first, then refine (if present), then create (if present).')
}).strict();

export type SearchInput = z.infer<typeof searchInputSchema>;
export type SearchOutput = z.infer<typeof searchOutputSchema>;
