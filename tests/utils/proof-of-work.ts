export interface ProofStepDefinition {
  heading: string;
  body: string;
  proofCmd?: string;
  timeoutSeconds?: number;
}

export function buildProofMarkdown(title: string, steps: ProofStepDefinition[]): string {
  const h1 = `# ${title}`;
  const sections = steps.map((step, index) => {
    const timeout = step.timeoutSeconds ?? 30;
    const cmd = step.proofCmd || `echo "step-${index + 1}"`;
    return `\n\n## ${step.heading}\n${step.body}\n\nPROOF OF WORK: timeout ${timeout}s ${cmd}`;
  }).join('');
  return `${h1}${sections}`;
}

