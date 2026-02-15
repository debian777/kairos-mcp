/**
 * kairos_begin input/output schemas (zod-only, no runtime deps).
 * Used by kairos_begin tool registration and by unit tests to assert response shape.
 */
import { z } from 'zod';

const memoryUriSchema = z
  .string()
  .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

/** Build input and output schemas for kairos_begin. */
export function buildBeginSchemas() {
  const inputSchema = z.object({
    uri: memoryUriSchema.describe('URI of step 1 (from kairos_search.start_here or choices[].uri after you pick one)')
  });

  const challengeSchema = z.object({
    type: z.enum(['shell', 'mcp', 'user_input', 'comment']),
    description: z.string(),
    nonce: z.string().optional().describe('Include in solution.nonce when present'),
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

  const outputSchema = z.object({
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
    protocol_status: z
      .enum(['continue', 'completed'])
      .describe("'continue' = call kairos_next with next_step.uri and solution; 'completed' = call kairos_attest"),
    attest_required: z.boolean().optional().describe('When true, indicates kairos_attest should be called to finalize the protocol'),
    message: z.string().optional(),
    next_action: z.string().optional().nullable().describe('Action to take next (e.g., "call kairos_next with uri and solution matching challenge")')
  });

  return { inputSchema, outputSchema };
}

/** Output schema for kairos_begin (for tests and client validation). */
export function getKairosBeginOutputSchema() {
  return buildBeginSchemas().outputSchema;
}
