/**
 * Shared helpers for skill_zip / skill_tree integration tests.
 * Keeps each test file focused on assertions and under the repo line cap.
 */

import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';

export const SKILL_EXPORT_BASE_URL = getTestAuthBaseUrl();
export const SKILL_EXPORT_API_BASE = `${SKILL_EXPORT_BASE_URL}/api`;

interface TrainItem {
  uri?: string;
  adapter_uri?: string;
  artifact_uuid?: string;
}

interface TrainResponse {
  status: string;
  items: TrainItem[];
}

export async function trainAdapterMarkdown(
  markdown: string,
  options?: { space?: string }
): Promise<{ adapterUri: string; layerUri: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/markdown',
    'X-LLM-Model-ID': 'test-model',
    ...getAuthHeaders()
  };
  if (options?.space) {
    headers['X-Space'] = options.space;
  }
  const res = await fetch(`${SKILL_EXPORT_API_BASE}/train/raw?force=true`, {
    method: 'POST',
    headers,
    body: markdown
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`train failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as TrainResponse;
  const item = data.items?.[0];
  if (!item?.uri || !item.adapter_uri) {
    throw new Error(`train response missing uri or adapter_uri: ${JSON.stringify(data)}`);
  }
  return { adapterUri: item.adapter_uri, layerUri: item.uri };
}

export async function trainArtifact(
  adapterUri: string,
  name: string,
  mime: string,
  body: string
): Promise<string> {
  const res = await fetch(`${SKILL_EXPORT_API_BASE}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      llm_model_id: 'test-model',
      content: body,
      mime,
      artifact_name: name,
      adapter_uri: adapterUri
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`train artifact failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as TrainResponse;
  const item = data.items?.[0];
  if (!item?.uri) {
    throw new Error(`train artifact response missing uri: ${JSON.stringify(data)}`);
  }
  return item.uri;
}

export async function exportRaw(input: Record<string, unknown>): Promise<Response> {
  return fetch(`${SKILL_EXPORT_API_BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(input)
  });
}

export async function exportJson<T = Record<string, unknown>>(input: Record<string, unknown>): Promise<T> {
  const res = await exportRaw(input);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`export failed (${res.status}) for ${JSON.stringify(input)}: ${text}`);
  }
  return (await res.json()) as T;
}

export function buildAdapterMarkdown(slug: string, title: string, extraStepBody = ''): string {
  return `---
slug: ${slug}
---

# ${title}

## Activation Patterns
Run when user asks for ${slug}.

## Step 1
${extraStepBody || `body of step 1 for ${slug}`}

\`\`\`json
{"contract":{"type":"comment","description":"step 1 of ${slug}"}}
\`\`\`

## Reward Signal
Done.`;
}

export interface ExportSkillZipResponse {
  uri: string;
  format: 'skill_zip';
  content_type: string;
  content: string;
  content_encoding?: 'base64';
  bundle_sha256?: string;
  item_count: number;
  export_adapter_count: number;
  skill_bundle_manifest: string;
  download_ref?: {
    url: string;
    expires_at: string;
    filename?: string;
    content_type?: string;
  };
}

export interface ExportSkillTreeResponse {
  uri: string;
  format: 'skill_tree';
  content_type: string;
  content: string;
  item_count: number;
  export_adapter_count: number;
}

export interface SkillBundleManifest {
  type: 'skill_bundle';
  format: 'zip';
  bundle_sha256?: string;
  skills: Array<{ slug: string; entrypoint: string; artifacts: string[] }>;
}

export async function downloadSkillZip(data: ExportSkillZipResponse): Promise<Buffer> {
  if (data.download_ref?.url) {
    const res = await fetch(data.download_ref.url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`download_ref failed (${res.status}): ${text}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  if (data.content_encoding === 'base64') {
    return Buffer.from(data.content, 'base64');
  }
  throw new Error(`skill_zip response missing download_ref or inline base64: ${JSON.stringify(data)}`);
}
