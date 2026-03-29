/**
 * Shared helpers for adapter space move / fork integration tests.
 */

export interface SpaceRow {
  name: string;
  space_id: string;
  type: 'personal' | 'group' | 'app' | 'other';
  adapters?: Array<{ adapter_id: string; title: string }>;
}

export function buildSpaceMoveMarkdown(title: string): string {
  return `# ${title}

## Activation Patterns
Space move / fork integration test.

## Step 1
Body.

\`\`\`json
{"contract": {"type": "comment", "comment": {"min_length": 10}, "required": true}}
\`\`\`

## Reward Signal
Done.`;
}

export function parseAdapterUuidFromUri(adapterUri: string): string {
  const m = /^kairos:\/\/adapter\/([0-9a-f-]{36})$/i.exec(adapterUri.trim());
  if (!m) throw new Error(`Not an adapter URI: ${adapterUri}`);
  return m[1]!.toLowerCase();
}

export function locationsForAdapterTitle(
  spaces: SpaceRow[],
  title: string
): Array<{ type: string; spaceName: string; adapterId: string }> {
  const out: Array<{ type: string; spaceName: string; adapterId: string }> = [];
  for (const s of spaces) {
    const hit = s.adapters?.find((a) => a.title === title);
    if (hit) out.push({ type: s.type, spaceName: s.name, adapterId: hit.adapter_id });
  }
  return out;
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
