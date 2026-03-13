/**
 * Test Run (target) mock for Protocol UX Storybook. Used only by ProtocolUXMockups.stories.
 */

import { ChallengeCardMock, StepFlowGraphMock } from "./ProtocolUXMockupContent";

const MOCK_URI = "kairos://mem/abc123";
const MOCK_STEPS = [
  { label: "Build", type: "shell" as const, summary: "Shell: npm run build", payload: { cmd: "npm run build" } },
  { label: "Run tests", type: "shell" as const, summary: "Shell: npm test", payload: { cmd: "npm test" } },
  { label: "Deploy", type: "shell" as const, summary: "Shell: npm run deploy", payload: { cmd: "npm run deploy" } },
];

export function RunGuidedTargetContent() {
  const currentStepIndex = 1;
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Test Run</h1>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        Step through the saved run in the browser and submit the same data the current run flow expects.
      </p>

      <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]" role="status">
        <span className="font-medium text-[var(--color-text-heading)]">Step 2 of 4</span>
        <span>· Active manual test session</span>
      </div>

      <section className="mb-6" aria-labelledby="run-flow-heading">
        <h2 id="run-flow-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Progress
        </h2>
        <StepFlowGraphMock
          steps={MOCK_STEPS.map((s) => ({ label: s.label }))}
          currentIndex={currentStepIndex}
        />
      </section>

      <section aria-labelledby="run-current-step" className="mb-6">
        <h2 id="run-current-step" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Current step
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <div className="text-sm text-[var(--color-text-muted)] mb-2">
            Step URI: <span className="font-mono break-all">{MOCK_URI}</span>
          </div>
          <div className="prose prose-sm max-w-none text-[var(--color-text)]">
            <p className="m-0">Run the test suite and ensure all tests pass.</p>
          </div>
        </div>
      </section>
      <section aria-labelledby="run-challenge" className="mb-6">
        <h2 id="run-challenge" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Challenge
        </h2>
        <ChallengeCardMock type="shell" payload={{ cmd: "npm test" }} />
      </section>
      <section aria-labelledby="run-solution" className="mb-6">
        <h2 id="run-solution" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Solution
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <div className="text-sm text-[var(--color-text-muted)] mb-2">
            Submit shell result (exit code, stdout, stderr)
          </div>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white"
          >
            Submit step
          </button>
        </div>
      </section>
    </div>
  );
}
