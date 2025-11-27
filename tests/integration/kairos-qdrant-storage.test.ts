import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? 'kb_resources';

function postJson<T>(urlString: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const requestImpl = url.protocol === 'https:' ? httpsRequest : httpRequest;

    const req = requestImpl(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : ({} as T));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Qdrant request failed (${res.statusCode}): ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function purgeExistingProtocols(label: string) {
  // Delete all points in Qdrant that match the provided label without relying on kairos_begin
  await postJson(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/delete`, {
    filter: {
      must: [
        {
          key: 'label',
          match: { value: label }
        }
      ]
    }
  });

  // Wait briefly for deletion to propagate
  await new Promise(resolve => setTimeout(resolve, 500));

  // Ensure collection no longer contains the label before proceeding
  for (let attempt = 0; attempt < 3; attempt++) {
    const scrollResponse = await postJson<{
      result?: { points?: Array<{ payload?: Record<string, any> }> };
    }>(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/scroll`, {
      filter: {
        must: [
          {
            key: 'label',
            match: { value: label }
          }
        ]
      },
      limit: 1
    });

    const points = scrollResponse.result?.points || [];
    if (points.length === 0) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Failed to purge existing Qdrant points for label: ${label}`);
}

describe('Qdrant storage verification', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;
  const QUERY = 'AI CODING RULES';

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('minted AI CODING RULES documents exist in Qdrant collection', async () => {
    await purgeExistingProtocols(QUERY);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const docPath = join(process.cwd(), 'tests', 'test-data', 'AI_CODING_RULES.md');
    const markdownDoc = readFileSync(docPath, 'utf-8');

    const mintCall = {
      name: 'kairos_mint',
      arguments: {
        markdown_doc: markdownDoc,
        llm_model_id: 'test-ai-coding-rules',
        force_update: true
      }
    };
    const mintResult = await mcpConnection.client.callTool(mintCall);
    const mintPayload = parseMcpJson(mintResult, '[kairos_mint] AI CODING RULES');

    withRawOnFail({ call: mintCall, result: mintResult }, () => {
      expect(mintPayload.status).toBe('stored');
      expect(Array.isArray(mintPayload.items)).toBe(true);
      expect(mintPayload.items.length).toBeGreaterThanOrEqual(1);
    }, '[kairos_mint] AI CODING RULES raw');

    const firstItem = (mintPayload.items || [])[0];
    expect(firstItem).toBeDefined();

    await new Promise(resolve => setTimeout(resolve, 3000));

    const scrollResponse = await postJson<{
      result?: { points?: Array<{ payload?: Record<string, any> }> };
    }>(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/scroll`, {
      filter: {
        must: [
          {
            key: 'label',
            match: { value: firstItem.label }
          }
        ]
      },
      limit: 10
    });

    const points = scrollResponse.result?.points || [];
    expect(points.length).toBeGreaterThan(0);

    const matched = points.some(point => point.payload?.label === firstItem.label);
    expect(matched).toBe(true);
  }, 60000);
});

