import type { ZodError } from 'zod';

export const MCP_INVALID_TOOL_INPUT = 'INVALID_TOOL_INPUT' as const;

export type KairosToolNameForInputTeaching =
  | 'activate'
  | 'forward'
  | 'reward'
  | 'train'
  | 'tune'
  | 'delete'
  | 'export'
  | 'spaces';

function issuePaths(error: ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? i.path.join('.') : '(root)'));
}

function hasTopLevelField(error: ZodError, field: string): boolean {
  return error.issues.some((i) => i.path[0] === field);
}

function teachingActivate(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  const queryProblem = hasTopLevelField(error, 'query') || paths.some((p) => p.startsWith('query'));
  const message = queryProblem
    ? 'Input validation error: `activate` needs a non-empty `query` string summarizing the user intent (about 3–8 words is enough). Optional: `space` / `space_id` to narrow search; optional `max_choices` within the allowed range.'
    : 'Input validation error: Check `activate` arguments against the tool schema: required `query`; optional `space`, `space_id`, `max_choices`.';
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'activate',
    must_obey: true,
    message,
    next_action:
      'Call activate again with {"query":"<short intent from the user message>"}. Use spaces first if you need allowed space names.',
    invalid_fields: paths
  };
}

function teachingForward(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  const uriProblem = hasTopLevelField(error, 'uri');
  const solutionProblem = hasTopLevelField(error, 'solution') || paths.some((p) => p.startsWith('solution'));
  let detail: string;
  if (uriProblem) {
    detail =
      'The `uri` argument is required and must be a JSON string (quoted). After activate, copy `choices[].uri` from the row you picked. First run: adapter URI only, omit `solution`. Later runs: use the layer `uri` from the last forward response, include `solution` matching `contract.type`.';
  } else if (solutionProblem) {
    detail =
      '`solution` must match the current `contract.type` (tensor, shell, mcp, user_input, comment) and include the matching payload object. Omit `solution` only on the first call when starting from an adapter URI.';
  } else {
    detail =
      'See the forward tool description: pass `uri` (adapter or layer) and optional `solution` shaped for the active contract.';
  }
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'forward',
    must_obey: true,
    message: `Input validation error: Invalid arguments for tool forward. ${detail}`,
    next_action:
      'Retry forward with valid JSON arguments, e.g. {"uri":"kairos://adapter/<uuid>"} with the exact URI string from activate or the prior forward response.',
    invalid_fields: paths
  };
}

function teachingReward(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'reward',
    must_obey: true,
    message:
      'Input validation error: `reward` needs `uri` = final layer URI from the last forward (`kairos://layer/<uuid>` with `?execution_id=...` when the run used it), plus `outcome` ("success" or "failure"). Optional: score, feedback, rater, rubric_version, llm_model_id.',
    next_action:
      'Call reward with {"uri":"<layer uri from forward>","outcome":"success"|"failure"} — copy the layer uri verbatim from the forward response that told you to reward.',
    invalid_fields: paths
  };
}

function teachingTrain(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  const md = hasTopLevelField(error, 'markdown_doc') || hasTopLevelField(error, 'source_adapter_uri');
  const model = hasTopLevelField(error, 'llm_model_id');
  let extra = '';
  if (model) {
    extra += ' Provide non-empty `llm_model_id`.';
  }
  if (md) {
    extra +=
      ' Supply full adapter `markdown_doc` and/or `source_adapter_uri` (fork) so at least one source of markdown exists.';
  }
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'train',
    must_obey: true,
    message: `Input validation error: Invalid arguments for tool train.${extra} See train tool description for optional force_update, protocol_version, space.`,
    next_action:
      'Retry train with {"markdown_doc":"...","llm_model_id":"..."} or with source_adapter_uri (and optional markdown_doc override).',
    invalid_fields: paths
  };
}

function teachingTune(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'tune',
    must_obey: true,
    message:
      'Input validation error: `tune` requires non-empty `uris` (adapter and/or layer URIs). Provide at least one of: parallel `markdown_doc` strings (same length as uris), `updates` map, or `space` to move targets.',
    next_action:
      'Call tune with {"uris":["kairos://adapter/..."],"markdown_doc":["..."]} or {"uris":[...],"space":"personal"} — URIs must match kairos://adapter/{uuid} or kairos://layer/{uuid}[?execution_id=...].',
    invalid_fields: paths
  };
}

function teachingDelete(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'delete',
    must_obey: true,
    message:
      'Input validation error: `delete` requires `uris`: a non-empty array of adapter or layer URIs (kairos://adapter/{uuid} or kairos://layer/{uuid}[?execution_id=...]).',
    next_action: 'Retry delete with {"uris":["kairos://adapter/<uuid>"]} or layer URIs you intend to remove.',
    invalid_fields: paths
  };
}

function teachingExport(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'export',
    must_obey: true,
    message:
      'Input validation error: `export` requires `uri` (adapter or layer). Optional `format` (markdown, trace_jsonl, reward_jsonl, sft_jsonl, preference_jsonl) defaults to markdown; optional `include_reward` boolean.',
    next_action:
      'Call export with {"uri":"kairos://adapter/<uuid>","format":"markdown"} using the target from forward or activate.',
    invalid_fields: paths
  };
}

function teachingSpaces(error: ZodError): Record<string, unknown> {
  const paths = issuePaths(error);
  return {
    error: MCP_INVALID_TOOL_INPUT,
    tool: 'spaces',
    must_obey: true,
    message:
      'Input validation error: `spaces` accepts optional booleans only: `include_adapter_titles`, `include_widget_html` (both default false).',
    next_action: 'Call spaces with {} or {"include_adapter_titles":true} — use JSON true/false, not strings.',
    invalid_fields: paths
  };
}

export function buildMcpInputTeachingPayload(
  tool: KairosToolNameForInputTeaching,
  error: ZodError,
  _raw: unknown
): Record<string, unknown> {
  switch (tool) {
    case 'activate':
      return teachingActivate(error);
    case 'forward':
      return teachingForward(error);
    case 'reward':
      return teachingReward(error);
    case 'train':
      return teachingTrain(error);
    case 'tune':
      return teachingTune(error);
    case 'delete':
      return teachingDelete(error);
    case 'export':
      return teachingExport(error);
    case 'spaces':
      return teachingSpaces(error);
  }
}

export function mcpToolInputValidationErrorResult(
  tool: KairosToolNameForInputTeaching,
  error: ZodError,
  raw: unknown
): { isError: true; content: [{ type: 'text'; text: string }] } {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(buildMcpInputTeachingPayload(tool, error, raw)) }]
  };
}
