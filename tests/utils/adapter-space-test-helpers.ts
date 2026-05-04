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
