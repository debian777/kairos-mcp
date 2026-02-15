/**
 * kairos_next input/output schemas (zod-only).
 * Used by kairos_next tool registration and tests.
 */
import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

const solutionSchema = z.object({
  type: z.enum(['shell', 'mcp', 'user_input', 'comment']).describe('Must match challenge.type'),
  nonce: z.string().optional().describe('Echo nonce from challenge (required when challenge has nonce)'),
  previousProofHash: z.string().optional().describe('SHA-256 hex of previous step proof, or challenge.genesis_hash for step 1'),
  shell: z.object({
    exit_code: z.number(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    duration_seconds: z.number().optional()
  }).optional(),
  mcp: z.object({
    tool_name: z.string(),
    arguments: z.any().optional(),
    result: z.any(),
    success: z.boolean()
  }).optional(),
  user_input: z.object({
    confirmation: z.string(),
    timestamp: z.string().optional()
  }).optional(),
  comment: z.object({ text: z.string() }).optional()
}).refine(
  (data) => !!(data.shell || data.mcp || data.user_input || data.comment),
  { message: 'At least one type-specific field (shell, mcp, user_input, or comment) must be provided' }
).refine(
  (data) => {
    if (data.type === 'shell' && !data.shell) return false;
    if (data.type === 'mcp' && !data.mcp) return false;
    if (data.type === 'user_input' && !data.user_input) return false;
    if (data.type === 'comment' && !data.comment) return false;
    return true;
  },
  { message: 'The type-specific field must match the solution type' }
);

const challengeSchema = z.object({
  type: z.enum(['shell', 'mcp', 'user_input', 'comment']),
  description: z.string(),
  nonce: z.string().optional().describe('Include in solution.nonce'),
  genesis_hash: z.string().optional().describe('Use as solution.previousProofHash for step 1'),
  shell: z.object({
    cmd: z.string(),
    timeout_seconds: z.number()
  }).optional(),
  mcp: z.object({
    tool_name: z.string(),
    expected_result: z.any().optional()
  }).optional(),
  user_input: z.object({
    prompt: z.string().optional()
  }).optional(),
  comment: z.object({
    min_length: z.number().optional()
  }).optional()
});

export const kairosNextInputSchema = z.object({
  uri: memoryUriSchema.describe('Current step URI (from next_step of previous response)'),
  solution: solutionSchema.describe('Proof matching challenge.type: shell/mcp/user_input/comment')
});

export const kairosNextOutputSchema = z.object({
  must_obey: z.boolean(),
  current_step: z.object({
    uri: memoryUriSchema,
    content: z.string(),
    mimeType: z.literal('text/markdown')
  }).optional().nullable(),
  next_step: z.object({
    uri: memoryUriSchema,
    position: z.string(),
    label: z.string()
  }).optional().describe('Present when protocol_status is continue; use this uri for the next kairos_next call'),
  challenge: challengeSchema,
  final_challenge: challengeSchema.optional().describe('Only present on the last step'),
  protocol_status: z.enum(['continue', 'completed', 'blocked']),
  attest_required: z.boolean().optional().describe('When true, indicates kairos_attest should be called to finalize the protocol'),
  message: z.string().optional(),
  next_action: z.string().optional().nullable().describe('Action to take next (e.g., "call kairos_next with next step uri and solution matching challenge")'),
  last_proof_hash: z.string().optional().describe('Use as solution.previousProofHash in the next kairos_next call')
});

export { memoryUriSchema };
