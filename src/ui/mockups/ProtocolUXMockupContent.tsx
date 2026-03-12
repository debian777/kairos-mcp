/**
 * Presentational mock content for Protocol UX (Target) Storybook stories.
 * Used only by ProtocolUXMockups.stories.tsx. Not part of the production app.
 */

const MOCK_URI = "kairos://mem/abc123";
const MOCK_STEP_LABELS = ["Build", "Run tests", "Deploy"];

const MOCK_STEPS = [
  { label: "Build", type: "shell" as const, summary: "Shell: npm run build", payload: { cmd: "npm run build" } },
  { label: "Run tests", type: "shell" as const, summary: "Shell: npm test", payload: { cmd: "npm test" } },
  { label: "Deploy", type: "shell" as const, summary: "Shell: npm run deploy", payload: { cmd: "npm run deploy" } },
];

const TYPE_BADGE_CLASS: Record<string, string> = {
  shell: "bg-[#fef3c7] text-[#92400e]",
  mcp: "bg-[#dbeafe] text-[#1e40af]",
  user_input: "bg-[#ede9fe] text-[#5b21b6]",
  comment: "bg-[#e2e8f0] text-[#334155]",
};

const CHALLENGE_TYPE_LABEL: Record<string, string> = {
  shell: "Shell command",
  mcp: "MCP tool call",
  user_input: "User input",
  comment: "Comment",
};

export function StepFlowGraphMock({
  steps,
  currentIndex,
}: {
  steps: { label: string }[];
  currentIndex?: number;
}) {
  const nodes = ["Start", ...steps.map((s) => s.label), "Attest"];
  return (
    <div
      className="flex flex-wrap items-center gap-1 py-3 px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
      role="img"
      aria-label={`Step flow: ${nodes.join(", ")}`}
    >
      {nodes.map((label, i) => {
        const isStep = i > 0 && i <= steps.length;
        const stepIndex = isStep ? i - 1 : undefined;
        const isCurrent = stepIndex !== undefined && stepIndex === currentIndex;
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[var(--color-text-muted)] px-0.5" aria-hidden>
                →
              </span>
            )}
            <span
              className={`inline-flex items-center justify-center min-h-[32px] px-3 rounded-[var(--radius-sm)] text-sm font-medium ${
                isCurrent
                  ? "bg-[var(--color-primary)] text-white ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg)]"
                  : "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ChallengeCardMock({
  type,
  payload,
}: {
  type: string;
  payload?: { cmd?: string; tool_name?: string; prompt?: string; min_length?: number };
}) {
  const label = CHALLENGE_TYPE_LABEL[type] ?? type;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block text-xs uppercase tracking-wide px-2 py-0.5 rounded ${TYPE_BADGE_CLASS[type] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]"}`}
        >
          {label}
        </span>
      </div>
      {payload?.cmd && (
        <div className="mt-2">
          <div className="text-xs text-[var(--color-text-muted)]">Command</div>
          <code className="block mt-0.5 font-mono text-sm text-[var(--color-text)] bg-[var(--color-surface)] px-3 py-2 rounded break-all">
            {payload.cmd}
          </code>
        </div>
      )}
      {payload?.tool_name && (
        <div className="mt-2 text-sm text-[var(--color-text)]">Tool: {payload.tool_name}</div>
      )}
      {payload?.prompt && (
        <div className="mt-2 text-sm text-[var(--color-text)]">{payload.prompt}</div>
      )}
      {payload?.min_length != null && (
        <div className="mt-2 text-sm text-[var(--color-text-muted)]">Min length: {payload.min_length} chars</div>
      )}
    </div>
  );
}

function RenderedContentMock() {
  return (
    <div className="prose prose-sm max-w-none text-[var(--color-text)]">
      <p className="m-0 mb-2">
        Run the build script. Ensure the project compiles and assets are produced in the output directory.
      </p>
      <ul className="mt-2 mb-2 pl-6 list-disc">
        <li>Install dependencies if needed</li>
        <li>Run the build command</li>
      </ul>
      <pre className="mt-2 p-3 rounded bg-[var(--color-surface)] text-sm font-mono overflow-x-auto m-0">
        <code>npm run build</code>
      </pre>
    </div>
  );
}
const MOCK_EDITOR_VALUE = [
  "# Deploy and test workflow",
  "",
  "## Natural Language Triggers",
  "",
  "deploy and test",
  "",
  "## Build",
  "",
  "Run build.",
  "",
  "```json",
  '{"challenge": {"type": "shell", "shell": {"cmd": "npm run build"}}}',
  "```",
].join("\n");

export function ProtocolDetailTargetContent() {
  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">
        Deploy and test workflow
      </h1>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <p className="text-sm text-[var(--color-text-muted)] m-0">
          <code className="text-xs bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded break-all">{MOCK_URI}</code>
          <span className="ml-2">· Read-only</span>
        </p>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)]"
        >
          Copy URI
        </button>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)]"
        >
          Download (dump)
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white"
        >
          Run guided
        </button>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)]"
        >
          Edit
        </button>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)]"
        >
          Duplicate
        </button>
      </div>

      <section className="mb-6" aria-labelledby="flow-heading">
        <h2 id="flow-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Step flow
        </h2>
        <StepFlowGraphMock steps={MOCK_STEPS.map((s) => ({ label: s.label }))} />
      </section>

      <section aria-labelledby="steps-heading" className="mb-6">
        <h2 id="steps-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Steps
        </h2>
        <ul className="list-none p-0 m-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] divide-y divide-[var(--color-border)]">
          {MOCK_STEPS.map((step, i) => (
            <li key={i} className="p-4">
              <strong className="block text-[var(--color-text-heading)]">{step.label}</strong>
              <div className="mt-2">
                <ChallengeCardMock type={step.type} payload={step.payload} />
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <RenderedContentMock />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="triggers-heading" className="mb-6">
        <h2 id="triggers-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Natural language triggers
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <p className="text-sm text-[var(--color-text)] m-0">deploy and test, run tests and deploy</p>
        </div>
      </section>

      <section aria-labelledby="completion-heading" className="mb-6">
        <h2 id="completion-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          Completion rule
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <p className="text-sm text-[var(--color-text)] m-0">Complete when all steps pass.</p>
        </div>
      </section>
    </div>
  );
}
export function ProtocolEditTargetContent() {
  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">
        Edit protocol
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Use markdown with H1 for title, H2 for step labels. Add a challenge block at the end of each verifiable step.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium text-[var(--color-text-heading)] mb-2">
            Protocol content (markdown)
          </label>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-muted)]">
              <span>Upload</span>
              <span>Bold</span>
              <span>Italic</span>
              <span>Code</span>
              <span className="ml-2">Preview</span>
            </div>
            <textarea
              readOnly
              placeholder="# My protocol..."
              className="w-full min-h-[18rem] px-4 py-3 text-sm text-[var(--color-text)] bg-[var(--color-surface)] font-mono resize-y border-0 focus:outline-none"
              value={MOCK_EDITOR_VALUE}
            />
          </div>
        </div>

        <div aria-label="Preview">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <div className="text-sm text-[var(--color-text-muted)]">Preview</div>
            <div className="text-lg font-semibold text-[var(--color-text-heading)] mt-1">Deploy and test workflow</div>
            <div className="mt-4">
              <div className="text-sm font-medium text-[var(--color-text-heading)] mb-2">Steps</div>
              <ul className="list-none p-0 m-0 space-y-2">
                {MOCK_STEP_LABELS.map((label, idx) => (
                  <li key={idx} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <div className="font-medium text-[var(--color-text-heading)]">{label}</div>
                    <div className="text-sm text-[var(--color-text-muted)] mt-1">Shell command</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 text-sm text-[var(--color-text-muted)]">
              <div><strong className="text-[var(--color-text-heading)]">Triggers:</strong> Present</div>
              <div className="mt-1"><strong className="text-[var(--color-text-heading)]">Completion:</strong> Present</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white"
        >
          Save
        </button>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export { RunGuidedTargetContent } from "./RunGuidedTargetMock";