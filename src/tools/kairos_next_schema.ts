/**
 * kairos_next input/output schemas (zod-only).
 * V2: removed next_step, protocol_status, attest_required, final_challenge.
 * Renamed genesis_hash -> proof_hash, previousProofHash -> proof_hash, last_proof_hash -> proof_hash.
 * Added error_code, retry_count for two-phase retry escalation.
 */
import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

const solutionSchema = z.object({
  type: z.enum(['shell', 'mcp', 'comment']).describe('Must match challenge.type'),
  nonce: z.string().optional().describe('Echo nonce from challenge'),
  proof_hash: z.string().optional().describe('Echo proof_hash from previous challenge or response'),
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
  comment: z.object({ text: z.string() }).optional()
}).refine(
  (data) => !!(data.shell || data.mcp || data.comment),
  { message: 'At least one type-specific field (shell, mcp, or comment) must be provided' }
).refine(
  (data) => {
    if (data.type === 'shell' && !data.shell) return false;
    if (data.type === 'mcp' && !data.mcp) return false;
    if (data.type === 'comment' && !data.comment) return false;
    return true;
  },
  { message: 'The type-specific field must match the solution type' }
);

const challengeSchema = z.object({
  type: z.enum(['shell', 'mcp', 'user_input', 'comment']),
  description: z.string(),
  nonce: z.string().optional().describe('Echo back as solution.nonce'),
  proof_hash: z.string().optional().describe('Echo back as solution.proof_hash'),
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
  uri: memoryUriSchema.describe('Current step URI (from next_action of previous response)'),
  solution: solutionSchema.describe('Proof matching challenge.type: shell/mcp/comment (user_input is handled server-side via elicitation)')
});

export const kairosNextOutputSchema = z.object({
  must_obey: z.boolean().describe('true for success and recoverable errors, false after max retries'),
  current_step: z.object({
    uri: memoryUriSchema,
    content: z.string(),
    mimeType: z.literal('text/markdown')
  }).optional().nullable(),
  challenge: challengeSchema,
  next_action: z.string().describe('Next tool call with embedded kairos://mem/ URI'),
  proof_hash: z.string().optional().describe('Hash of proof just stored. Use as solution.proof_hash for next step.'),
  message: z.string().optional(),
  error_code: z.string().optional().describe('Machine-readable error code (e.g., NONCE_MISMATCH, MAX_RETRIES_EXCEEDED)'),
  retry_count: z.number().optional().describe('Number of retries on this step (present on error responses)')
});

export { memoryUriSchema };
