/**
 * model-detector.ts
 * 
 * Heuristic detector for AI model/provider identity using HTTP headers, URL and response body.
 * No external dependencies. Drop into `src/utils/` and import.
 * 
 * Design:
 * - Prefer exact model from response body (top-level `model` or nested fields).
 * - Fall back to provider-specific response/request headers.
 * - Optionally use the request URL path to infer provider/deployment.
 * - Return a confidence score (0..1) and signals that explain the decision.
 * 
 * Limitations:
 * - Many providers do not expose model/version in headers.
 * - Heuristics may evolve; update PROVIDER_MARKERS/MODEL_PREFIXES as you observe new patterns.
 */

export type Provider =
  | 'openai'
  | 'azure-openai'
  | 'anthropic'
  | 'google-vertex'
  | 'groq'
  | 'mistral'
  | 'cohere'
  | 'together'
  | 'xai'
  | 'perplexity'
  | 'ollama'
  | 'replicate'
  | 'minimax'
  | 'local'
  | 'unknown';

export interface ModelDetection {
  provider: Provider;
  model?: string;
  alias?: string;
  confidence: number; // 0..1
  signals: string[];  // brief notes explaining the decision
  warnings?: string[];
}

/** A permissive shape for headers that covers Node, Fetch and custom objects. */
export type HeadersLike =
  | Record<string, string | number | string[] | undefined>
  | Headers;

/** Normalise headers to lowercase key -> string value. Joins array values with ','. */
export function normaliseHeaders(h?: HeadersLike): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (typeof (globalThis as any).Headers !== 'undefined' && h instanceof Headers) {
    for (const [k, v] of (h as Headers).entries()) {
      out[k.toLowerCase()] = String(v);
    }
    return out;
  }
  const obj = h as Record<string, any>;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) out[k.toLowerCase()] = v.join(',');
    else out[k.toLowerCase()] = String(v);
  }
  return out;
}

/** Attempt to extract a model name from common response body shapes. */
export function extractModelFromBody(body: any): string | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return extractModelFromBody(parsed);
    } catch {
      return undefined;
    }
  }
  if (typeof body !== 'object') return undefined;
  // OpenAI/Anthropic/Cohere often include top-level `model`
  if (typeof body.model === 'string') return body.model;
  // Some providers return in `meta` or inside choices
  if (body.meta?.model && typeof body.meta.model === 'string') return body.meta.model;
  if (Array.isArray(body.choices) && body.choices.length > 0) {
    const m = body.choices[0]?.model;
    if (typeof m === 'string') return m;
  }
  // Perplexity-like
  if (body?.usage?.model && typeof body.usage.model === 'string') return body.usage.model;
  // Fallback: search shallow keys
  for (const [k, v] of Object.entries(body)) {
    if (k.toLowerCase().includes('model') && typeof v === 'string') {
      return v;
    }
  }
  return undefined;
}

/** Known model name prefixes mapped to likely providers. */
const MODEL_PREFIXES: Array<{ re: RegExp; provider: Provider }> = [
  // OpenAI
  { re: /^gpt[-_]?/i, provider: 'openai' },
  { re: /^o[34](-|\.)?mini/i, provider: 'openai' },
  { re: /^o[34](-|\.)?state/i, provider: 'openai' },
  // Anthropic
  { re: /^claude/i, provider: 'anthropic' },
  // Google/Vertex
  { re: /^gemini/i, provider: 'google-vertex' },
  // Groq (often proxies open weights like Llama/Mixtral)
  { re: /^groq[-_]?/i, provider: 'groq' },
  // Mistral
  { re: /^mistral|^mixtral/i, provider: 'mistral' },
  // Cohere
  { re: /^command|^command[-_]/i, provider: 'cohere' },
  // xAI
  { re: /^grok[-_]?/i, provider: 'xai' },
  // Together (various upstream models; heuristically mark provider only when URL matches)
  // Perplexity (uses pplx-* names)
  { re: /^pplx[-_]/i, provider: 'perplexity' },
  // Ollama local
  { re: /^ollama:/i, provider: 'ollama' },
  // Replicate often uses <owner>/<model>
  { re: /^[a-z0-9_.-]+\/[a-z0-9_.-]+:[a-z0-9_.-]+$/i, provider: 'replicate' },
  // Minimax
  { re: /^minimax/i, provider: 'minimax' },
];

/** Header markers that strongly suggest a provider. Keys are lowercase. */
const PROVIDER_MARKERS: Record<Provider, Array<string | RegExp>> = {
  'openai': [
    'openai-organization', // request header (client side), sometimes echoed
    /x-openai-.+/,         // internal/proxy headers in some setups
  ],
  'azure-openai': [
    'apim-request-id',
    'x-ms-request-id',
    'x-azure-ref',
    'x-ms-region',
  ],
  'anthropic': [
    'anthropic-version',
    'anthropic-beta',
    // Response often has `request-id`, not unique enough alone, so combined with version
  ],
  'google-vertex': [
    'x-goog-api-client',
    'x-goog-quota-user',
    'x-goog-request-params',
  ],
  'groq': [
    'groq-organization',
    'x-groq-warning',
    /x-groq-.+/,
  ],
  'mistral': [
    'x-mistral-request-id',
    'mistral-client',
  ],
  'cohere': [
    'cohere-version',
    'x-trace-id', // weak
  ],
  'together': [
    'x-together-request-id',
    'together-client',
  ],
  'xai': [
    'x-xai-meta',
    'x-xai-compute-region',
  ],
  'perplexity': [
    'x-pplx-request-id',
    'x-pplx-usage',
  ],
  'ollama': [
    // usually local; no clear headers
  ],
  'replicate': [
    'x-replicate-request-id',
    'x-replicate-version',
  ],
  'minimax': [
    'x-minimax-request-id',
    'x-minimax-model',
  ],
  'local': [],
  'unknown': [],
};

/** URL substrings that hint at a provider. */
const URL_MARKERS: Array<{ match: RegExp; provider: Provider }> = [
  { match: /api\.openai\.com/i, provider: 'openai' },
  { match: /openai\.azure\.com|\.openai\.azure\.com/i, provider: 'azure-openai' },
  { match: /anthropic\.com|api\.anthropic\.com/i, provider: 'anthropic' },
  { match: /generativelanguage\.googleapis\.com|vertexai/i, provider: 'google-vertex' },
  { match: /api\.groq\.com/i, provider: 'groq' },
  { match: /api\.mistral\.ai/i, provider: 'mistral' },
  { match: /api\.cohere\.ai/i, provider: 'cohere' },
  { match: /api\.together\.xyz/i, provider: 'together' },
  { match: /api\.xai\.com/i, provider: 'xai' },
  { match: /api\.perplexity\.ai/i, provider: 'perplexity' },
  { match: /ollama/i, provider: 'ollama' },
  { match: /replicate\.com|api\.replicate\.com/i, provider: 'replicate' },
  { match: /api\.minimax\.com/i, provider: 'minimax' },
];

/** Confidence helpers */
function bump(conf: number, delta: number, cap = 1): number {
  return Math.min(cap, conf + delta);
}

/**
 * Detect model/provider identity.
 * @param respHeaders Response headers (required for most detection).
 * @param body Optional parsed response body, if available.
 * @param requestUrl Optional URL used (helps disambiguate Azure/OpenAI/etc.).
 * @param reqHeaders Optional request headers (sometimes carry provider/version).
 */
export function detectModelIdentity(
  respHeaders?: HeadersLike,
  body?: any,
  requestUrl?: string,
  reqHeaders?: HeadersLike
): ModelDetection {
  const signals: string[] = [];
  const warnings: string[] = [];
  let confidence = 0.0;
  let provider: Provider = 'unknown';
  const nResp = normaliseHeaders(respHeaders);
  const nReq = normaliseHeaders(reqHeaders);

  // 1) Model from body (strongest)
  const model = extractModelFromBody(body);
  if (model) {
    signals.push(`model:${model}`);
    // Map by prefix
    for (const { re, provider: p } of MODEL_PREFIXES) {
      if (re.test(model)) {
        provider = p;
        confidence = bump(confidence, 0.6);
        signals.push(`match:model-prefix:${re.toString()}`);
        break;
      }
    }
  }

  // 2) URL markers
  if (requestUrl) {
    for (const { match, provider: p } of URL_MARKERS) {
      if (match.test(requestUrl)) {
        if (provider === 'unknown') provider = p;
        confidence = bump(confidence, 0.25);
        signals.push(`match:url:${match}`);
        break;
      }
    }
  }

  // 3) Header markers (response first, then request)
  const headerChecks = [
    { src: 'response', headers: nResp },
    { src: 'request', headers: nReq },
  ] as const;

  for (const check of headerChecks) {
    for (const [prov, markers] of Object.entries(PROVIDER_MARKERS) as [Provider, Array<string|RegExp>][]) {
      for (const m of markers) {
        if (!m) continue;
        const hit = typeof m === 'string'
          ? (check.headers[m] !== undefined)
          : Object.keys(check.headers).some((k) => (m as RegExp).test(k));
        if (hit) {
          if (provider === 'unknown') provider = prov;
          confidence = bump(confidence, 0.25);
          signals.push(`match:${check.src}-header:${typeof m === 'string' ? m : (m as RegExp).toString()}`);
        }
      }
    }
  }

  // 4) Special-case Azure OpenAI: often body has `model` like gpt-*, but URL/headers indicate azure deployment
  if (provider === 'openai' && requestUrl && /azure\.com/i.test(requestUrl)) {
    provider = 'azure-openai';
    signals.push('override:azure-endpoint');
  }

  // 5) If still unknown but model present, keep provider unknown with lower confidence
  if (provider === 'unknown' && model) {
    confidence = bump(confidence, 0.2);
  }

  // 6) Sanity warning if confidence low
  if (confidence < 0.4) {
    warnings.push('Low confidence – headers do not strongly identify a provider; relying on weak signals.');
  }

  const result: ModelDetection = {
    provider,
    confidence: Number(confidence.toFixed(2)),
    signals,
  };

  if (model) {
    result.model = model;
  }

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/* -------------------------
 * Inline usage examples (remove if not needed)
 * -------------------------
 *
 * // Example 1: OpenAI-like body
 * const det1 = detectModelIdentity(
 *   { 'x-request-id': 'abc' },
 *   { model: 'gpt-4o', choices: [] },
 *   'https://api.openai.com/v1/chat/completions'
 * );
 * // -> { provider: 'openai', model: 'gpt-4o', confidence ~0.85, ... }
 *
 * // Example 2: Azure OpenAI endpoint with gpt model
 * const det2 = detectModelIdentity(
 *   { 'apim-request-id': 'xyz' },
 *   { model: 'gpt-4o-mini' },
 *   'https://myres.openai.azure.com/openai/deployments/gpt4o/chat/completions?api-version=2024-XX-XX'
 * );
 * // -> { provider: 'azure-openai', model: 'gpt-4o-mini', ... }
 *
 * // Example 3: Anthropic required version header
 * const det3 = detectModelIdentity(
 *   { 'request-id': 'r1', 'anthropic-version': '2023-06-01' },
 *   { model: 'claude-3-7-sonnet-20250219' },
 *   'https://api.anthropic.com/v1/messages'
 * );
 * // -> { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', ... }
 *
 * // Example 4: Unknown provider; only X-Request-Id present
 * const det4 = detectModelIdentity({ 'x-request-id': 'z' }, { choices: [{}] });
 * // -> { provider: 'unknown', confidence low, warnings present }
 *
 */
