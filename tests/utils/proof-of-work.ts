export interface ProofStepDefinition {
  heading: string;
  body: string;
  proofCmd?: string;
  timeoutSeconds?: number;
}

function challengeBlock(cmd: string, timeoutSeconds: number): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `\n\n\`\`\`json\n{"challenge":{"type":"shell","shell":{"cmd":"${esc(cmd)}","timeout_seconds":${timeoutSeconds}},"required":true}}\n\`\`\``;
}

export function buildProofMarkdown(title: string, steps: ProofStepDefinition[]): string {
  const h1 = `# ${title}`;
  const sections = steps.map((step, index) => {
    const timeout = step.timeoutSeconds ?? 30;
    const cmd = step.proofCmd || `echo "step-${index + 1}"`;
    return `\n\n## ${step.heading}\n${step.body}${challengeBlock(cmd, timeout)}`;
  }).join('');
  return `${h1}${sections}`;
}

