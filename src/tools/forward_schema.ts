import { z } from 'zod';
import { ADAPTER_URI_INPUT_REGEX, LAYER_URI_INPUT_REGEX } from './kairos-uri.js';

const adapterUriSchema = z
  .string()
  .regex(ADAPTER_URI_INPUT_REGEX, 'must match kairos://adapter/{uuid} or kairos://adapter/{slug}');

const layerUriSchema = z
  .string()
  .regex(LAYER_URI_INPUT_REGEX, 'must match kairos://layer/{uuid}[?execution_id={uuid}]');

const forwardUriSchema = z.union([adapterUriSchema, layerUriSchema]);

const tensorOutputSchema = z.object({
  name: z.string(),
  type: z.string(),
  min_length: z.number().optional(),
  max_length: z.number().optional(),
  min_items: z.number().optional(),
  max_items: z.number().optional()
});

const tensorContractSchema = z.object({
  required_inputs: z.array(z.string()),
  output: tensorOutputSchema,
  merge: z.string().optional(),
  condition: z.string().optional()
});

export const forwardContractSchema = z.object({
  type: z.enum(['tensor', 'shell', 'mcp', 'user_input', 'comment']),
  required: z.boolean().optional(),
  description: z.string().optional(),
  nonce: z.string().optional(),
  proof_hash: z.string().optional(),
  tensor: tensorContractSchema.optional(),
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

export const forwardSolutionSchema = z.object({
  type: z.enum(['tensor', 'shell', 'mcp', 'user_input', 'comment']).describe('Must match contract.type'),
  nonce: z.string().optional().describe('Echo nonce from contract for proof-based layers'),
  proof_hash: z.string().optional().describe('Echo proof_hash from previous layer when required'),
  tensor: z.object({
    name: z.string(),
    value: z.any()
  }).optional(),
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
  comment: z.object({
    text: z.string()
  }).optional(),
  trace: z.string().optional().describe('Optional reasoning trace stored with the execution trace')
}).refine(
  (data) => !!(data.tensor || data.shell || data.mcp || data.user_input || data.comment),
  { message: 'At least one type-specific field must be provided' }
).refine(
  (data) => {
    if (data.type === 'tensor' && !data.tensor) return false;
    if (data.type === 'shell' && !data.shell) return false;
    if (data.type === 'mcp' && !data.mcp) return false;
    if (data.type === 'user_input' && !data.user_input) return false;
    if (data.type === 'comment' && !data.comment) return false;
    return true;
  },
  { message: 'The type-specific field must match the solution type' }
);

function isLayerUriWithExecutionId(uri: string): boolean {
  const match = uri.match(LAYER_URI_INPUT_REGEX);
  return Boolean(match?.[2]);
}

/** First forward in a run: adapter URI or layer URI without `?execution_id=...` (new execution). */
function isStartingNewForwardRun(uri: string): boolean {
  if (ADAPTER_URI_INPUT_REGEX.test(uri)) {
    return true;
  }
  const match = uri.match(LAYER_URI_INPUT_REGEX);
  return Boolean(match?.[1] && !match[2]);
}

/** Zod issue message; teaching layer matches this string exactly. */
export const FORWARD_SOLUTION_FORBIDDEN_ON_START_MESSAGE =
  'Omit `solution` when starting a run (`kairos://adapter/...` or `kairos://layer/{uuid}` without `?execution_id=...`). Read `contract` from the response, then call `forward` again with the layer URI including `?execution_id=...` and a `solution` matching `contract.type`.';

export const forwardInputSchema = z.object({
  uri: forwardUriSchema.describe('Adapter or layer URI'),
  solution: forwardSolutionSchema.optional().describe('Layer solution; omit to start a new forward execution')
}).superRefine((data, ctx) => {
  if (isStartingNewForwardRun(data.uri) && data.solution !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['solution'],
      message: FORWARD_SOLUTION_FORBIDDEN_ON_START_MESSAGE
    });
  }
  if (isLayerUriWithExecutionId(data.uri) && !data.solution) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['solution'],
      message:
        '`solution` is required when continuing a run with `kairos://layer/...?execution_id=...`. Omit `solution` only on the first forward call of a run.'
    });
  }
});

const forwardWireSolutionSchema = z.object({
  type: z
    .enum(['tensor', 'shell', 'mcp', 'user_input', 'comment'])
    .optional()
    .describe('Must match contract.type for continuation calls.'),
  nonce: z.string().optional(),
  proof_hash: z.string().optional(),
  tensor: z.object({
    name: z.string().optional(),
    value: z.any().optional()
  }).optional(),
  shell: z.object({
    exit_code: z.number().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    duration_seconds: z.number().optional()
  }).optional(),
  mcp: z.object({
    tool_name: z.string().optional(),
    arguments: z.any().optional(),
    result: z.any().optional(),
    success: z.boolean().optional()
  }).optional(),
  user_input: z.object({
    confirmation: z.string().optional(),
    timestamp: z.string().optional()
  }).optional(),
  comment: z.object({
    text: z.string().optional()
  }).optional(),
  trace: z.string().optional()
}).passthrough()
  .describe(
    'For the first forward call in a run, omit `solution`. For every continuation call in the same execution chain (layer URI with `?execution_id=...`), provide `solution` with the sub-object that matches `type` (`tensor`, `shell`, `mcp`, `user_input`, or `comment`).'
  );

/**
 * Wire registration schema for the MCP `forward` tool. The SDK only emits `tools/list` JSON Schema
 * for plain object Zod types; a `z.union` used for loose parsing yields empty `properties`.
 * The handler still validates with {@link forwardInputSchema} and returns teaching payloads on failure.
 * `uri` remains optional on the wire schema so `{}` and other malformed payloads reach the handler instead
 * of failing in the MCP SDK with a generic validation error.
 */
export const forwardMcpWireInputSchema = z
  .object({
    uri: z.string().optional(),
    solution: forwardWireSolutionSchema.optional()
  })
  .passthrough();

export const forwardOutputSchema = z.object({
  must_obey: z.boolean(),
  current_layer: z.object({
    uri: layerUriSchema,
    content: z.string(),
    mimeType: z.literal('text/markdown')
  }).optional().nullable(),
  contract: forwardContractSchema,
  tensor_in: z.record(z.string(), z.unknown()).optional(),
  next_action: z.string(),
  proof_hash: z.string().optional(),
  execution_id: z.string().optional(),
  message: z.string().optional(),
  error_code: z.string().optional(),
  retry_count: z.number().optional(),
  slug_disambiguation_note: z
    .string()
    .optional()
    .describe('When forward started from a slug that matched multiple adapters, explains which was chosen'),
  /** Human-readable space for the current layer (when payload carries space_id). */
  activation_space_name: z.string().optional(),
  /** Adapter title for the run (activator / H1). */
  context_adapter_name: z.string().optional(),
  /** Current step label (H2). */
  current_layer_label: z.string().optional(),
  /** 1-based index of this layer in the adapter (widget progress). */
  adapter_layer_index: z.number().int().positive().optional(),
  /** Total layers in the adapter (widget progress). */
  adapter_layer_count: z.number().int().positive().optional()
}).strict();

export type ForwardInput = z.infer<typeof forwardInputSchema>;
export type ForwardSolution = z.infer<typeof forwardSolutionSchema>;
export type ForwardOutput = z.infer<typeof forwardOutputSchema>;

