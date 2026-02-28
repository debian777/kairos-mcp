/**
 * kairos_begin input/output schemas (zod-only, no runtime deps).
 * V2: removed next_step, protocol_status, attest_required, final_challenge.
 * Renamed genesis_hash -> proof_hash.
 */
import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

/** Build input and output schemas for kairos_begin. */
export function buildBeginSchemas() {
  const inputSchema = z.object({
    uri: memoryUriSchema.describe('URI of step 1 (from kairos_search choices[].uri). Auto-redirects to step 1 if a non-step-1 URI is provided.')
  });

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

  const outputSchema = z.object({
    must_obey: z.boolean().describe('Always true for kairos_begin'),
    current_step: z.object({
      uri: memoryUriSchema,
      content: z.string(),
      mimeType: z.literal('text/markdown')
    }).optional().nullable(),
    challenge: challengeSchema,
    next_action: z.string().describe('Next tool call with embedded kairos://mem/ URI'),
    message: z.string().optional()
  });

  return { inputSchema, outputSchema };
}
