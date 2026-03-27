/**
 * Protocol UX target mock content for Storybook stories.
 * Uses the same RichTextEditor and RenderedMarkdown as the app for one editor, one renderer.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { CHALLENGE_TYPE_LABEL, ChallengeCard } from "@/components/ChallengeCard";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SurfaceCard } from "@/components/SurfaceCard";
import { StepFlowGraph } from "@/components/StepFlowGraph";

const MOCK_URI = "kairos://mem/abc123";

const MOCK_STEPS = [
  {
    label: "Build",
    type: "shell" as const,
    summary: "Build the app and create production assets.",
    payload: { cmd: "npm run build" },
    body: {
      intro: "Run the build command and confirm the output directory contains the final app bundle.",
      bullets: ["Install dependencies if needed", "Run the build command", "Confirm the build exits successfully"],
      code: "npm run build",
    },
  },
  {
    label: "Run tests",
    type: "shell" as const,
    summary: "Execute automated checks before release.",
    payload: { cmd: "npm test" },
    body: {
      intro: "Run the test suite and review any failures before continuing.",
      bullets: ["Run the project test command", "Capture the real exit code", "Paste stdout and stderr into testing"],
      code: "npm test",
    },
  },
  {
    label: "Deploy",
    type: "comment" as const,
    summary: "Record the release outcome and rollout status.",
    payload: { min_length: 50 },
    body: {
      intro: "Summarize what was deployed, where it went, and any follow-up that operators should watch.",
      bullets: ["Include the environment", "Mention verification results", "Call out rollback notes if relevant"],
    },
  },
];

function PrimaryButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
    >
      {children}
    </button>
  );
}

function FilterChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`min-h-[44px] rounded-full px-4 text-sm font-medium ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );
}

function RenderedContentMock({
  intro,
  bullets,
  code,
}: {
  intro: string;
  bullets: string[];
  code?: string;
}) {
  return (
    <div className="max-w-none text-[var(--color-text)]">
      <p className="mb-2 text-sm leading-6">{intro}</p>
      <ul className="mb-0 list-disc space-y-1 pl-6 text-sm leading-6">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      {code ? (
        <pre className="mt-3 m-0 overflow-x-auto rounded bg-[var(--color-surface)] p-3 text-sm font-mono">
          <code>{code}</code>
        </pre>
      ) : null}
    </div>
  );
}

function ToolbarIcon({
  children,
  className = "h-4 w-4",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function BulletListIcon() {
  return (
    <ToolbarIcon>
      <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M6 4h7" />
      <path d="M6 8h7" />
      <path d="M6 12h7" />
    </ToolbarIcon>
  );
}

function LinkIcon() {
  return (
    <ToolbarIcon>
      <path d="M6 10L4.5 11.5a2.5 2.5 0 1 1-3.5-3.5L2.5 6.5" />
      <path d="M10 6l1.5-1.5a2.5 2.5 0 1 1 3.5 3.5L13.5 9.5" />
      <path d="M5.5 10.5l5-5" />
    </ToolbarIcon>
  );
}

function QuoteIcon() {
  return (
    <ToolbarIcon>
      <path d="M5.5 5.5A2.5 2.5 0 0 0 3 8v2.5h3V8H4.5" />
      <path d="M11.5 5.5A2.5 2.5 0 0 0 9 8v2.5h3V8h-1.5" />
    </ToolbarIcon>
  );
}

function CodeBlockIcon() {
  return (
    <ToolbarIcon>
      <path d="M6 4L2.5 8L6 12" />
      <path d="M10 4l3.5 4L10 12" />
      <path d="M8.75 3.5L7.25 12.5" />
    </ToolbarIcon>
  );
}

function InlineCodeIcon() {
  return (
    <ToolbarIcon>
      <path d="M6 5.5l2 5-2 5" />
      <path d="M10 5.5l2 5-2 5" />
    </ToolbarIcon>
  );
}

function TableIcon() {
  return (
    <ToolbarIcon>
      <path d="M2 3h12v2H2V3z" />
      <path d="M2 7h12v1H2V7z" />
      <path d="M2 11h12v1H2v-1z" />
      <path d="M2 15h12v1H2v-1z" />
      <path d="M2 4v11" />
      <path d="M6 4v11" />
      <path d="M10 4v11" />
      <path d="M14 4v11" />
    </ToolbarIcon>
  );
}

function IconReviewTile({
  name,
  glyph,
  note,
}: {
  name: string;
  glyph: ReactNode;
  note: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
          {glyph}
        </div>
        <div>
          <div className="font-medium text-[var(--color-text-heading)]">{name}</div>
          <div className="text-sm text-[var(--color-text-muted)]">{note}</div>
        </div>
      </div>
    </div>
  );
}

export function EditorToolbarIconSetTargetContent() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Editor icon set</h1>
      <p className="mb-6 max-w-[70ch] text-sm text-[var(--color-text-muted)]">
        Review the proposed Markdown-safe editor controls in isolation. The set uses familiar Word-like cues,
        monochrome SVGs or simple glyphs, and inherits color from the active theme via <code>currentColor</code>.
      </p>

      <SurfaceCard
        title="Toolbar controls"
        subtitle="Functional, low-noise iconography for protocol authoring. Icons are intentionally generic and not brand-shaped."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <IconReviewTile name="Paragraph" glyph={<span className="text-base leading-none">¶</span>} note="Text structure stays in the form, not in hidden heading levels." />
          <IconReviewTile name="Bold" glyph={<strong className="text-sm font-semibold">B</strong>} note="Matches mainstream editor expectations." />
          <IconReviewTile name="Italic" glyph={<em className="text-sm">I</em>} note="Simple letterform is easier to scan than a custom symbol." />
          <IconReviewTile name="Bullet list" glyph={<BulletListIcon />} note="Neutral list symbol with three bullets and guide lines." />
          <IconReviewTile name="Numbered list" glyph={<span className="text-sm font-semibold">1.</span>} note="Uses the familiar document-editor convention." />
          <IconReviewTile name="Link" glyph={<LinkIcon />} note="Chain icon stays monochrome so it does not fight the page theme." />
          <IconReviewTile name="Quote" glyph={<QuoteIcon />} note="Uses a compact quotation mark motif, not decorative speech bubbles." />
          <IconReviewTile name="Inline code" glyph={<InlineCodeIcon />} note="Backtick-style glyph for single-backtick inline code." />
          <IconReviewTile name="Code block" glyph={<CodeBlockIcon />} note="Chevron and slash cue code without relying on color." />
          <IconReviewTile name="Table" glyph={<TableIcon />} note="Grid icon for inserting a markdown table." />
        </div>
      </SurfaceCard>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <SurfaceCard title="Why this works" subtitle="Human-familiar, theme-safe, and accessible.">
          <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-[var(--color-text)]">
            <li>Word-like controls reduce learning for non-technical authors.</li>
            <li>Monochrome icons adapt to light and dark themes through <code>currentColor</code>.</li>
            <li>Each control is paired with a tooltip and an <code>aria-label</code>.</li>
          </ul>
        </SurfaceCard>
        <SurfaceCard title="Brand boundary" subtitle="Toolbar icons and brand marks should stay separate.">
          <p className="text-sm text-[var(--color-text-muted)]">
            The toolbar icon set is not derived from the KAIROS logo. That is intentional: formatting controls should feel
            standard and legible, while the product logo remains the place for branded expression. The current favicon asset,
            however, is the same underlying artwork as <code>logo/kaiiros-mcp.svg</code>.
          </p>
        </SurfaceCard>
      </div>
    </div>
  );
}

/** Wrapper for Storybook: uses the app's RichTextEditor with local state so demos are interactive. */
function RichTextEditorDemo({
  label,
  markdown,
  hint,
}: {
  label: string;
  markdown: string;
  hint?: string;
}) {
  const [value, setValue] = useState(markdown);
  return <RichTextEditor value={value} onChange={setValue} label={label} hint={hint} />;
}

function StepEditorCard({
  stepNumber,
  label,
  type,
  challengeFields,
  bodyMarkdown,
}: {
  stepNumber: number;
  label: string;
  type: keyof typeof CHALLENGE_TYPE_LABEL;
  challengeFields: { label: string; value: string }[];
  bodyMarkdown: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-[var(--color-text-heading)]">Step {stepNumber}</div>
          <div className="text-sm text-[var(--color-text-muted)]">Human-friendly editor with Markdown-safe formatting.</div>
        </div>
        <SecondaryButton>Remove step</SecondaryButton>
      </div>
      <div className="mb-4">
        <label className="mb-2 block font-medium text-[var(--color-text-heading)]">Step label</label>
        <div className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)]">
          {label}
        </div>
      </div>
      <div className="mb-4">
        <label className="mb-2 block font-medium text-[var(--color-text-heading)]">Challenge type</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CHALLENGE_TYPE_LABEL).map(([key, value]) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === type}
              className={`min-h-[44px] rounded-[var(--radius-md)] px-4 text-sm font-medium ${
                key === type
                  ? "bg-[var(--color-primary)] text-white"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <RichTextEditorDemo label="Step content" markdown={bodyMarkdown} />
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 text-sm font-medium text-[var(--color-text-heading)]">Challenge fields</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {challengeFields.map((field) => (
            <div key={field.label}>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">{field.label}</label>
              <div className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)]">
                {field.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportMenuMock() {
  return (
    <div className="w-full max-w-[22rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
      <div className="mb-2 text-sm font-medium text-[var(--color-text-heading)]">Download</div>
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
      >
        <span>Download as Markdown</span>
        <span className="text-[var(--color-text-muted)]">.md</span>
      </button>
      <button
        type="button"
        className="mt-1 flex min-h-[44px] w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
      >
        <span>Download as Skill</span>
        <span className="text-[var(--color-text-muted)]">.zip</span>
      </button>
      <button
        type="button"
        className="mt-1 flex min-h-[44px] w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
      >
        <span>Edit as Skill</span>
        <span className="text-[var(--color-text-muted)]">bundle</span>
      </button>
      <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
        Skill export prepares a portable bundle for external AI tools. Internal terms like dump or raw never appear here.
      </p>
    </div>
  );
}

export function HomeTargetContent() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Home</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Start from a clear task: browse protocols, create a new workflow, or continue protocol testing.
      </p>

      <SurfaceCard
        title="Find the right protocol"
        subtitle="Home stays lightweight. Search and deeper discovery live in Browse."
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-2 block font-medium text-[var(--color-text-heading)]">Search protocols</label>
            <div className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
              e.g. deploy and test
            </div>
          </div>
          <div className="flex items-end">
            <PrimaryButton>Go to Browse</PrimaryButton>
          </div>
        </div>
      </SurfaceCard>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SurfaceCard title="Browse protocols" subtitle="Search or browse by label.">
          <PrimaryButton>Open Browse</PrimaryButton>
        </SurfaceCard>
        <SurfaceCard title="Create protocol" subtitle="Use the rendered editor to draft a new workflow.">
          <SecondaryButton>Create new</SecondaryButton>
        </SurfaceCard>
        <SurfaceCard title="Test Run" subtitle="Resume a saved test run from this device.">
          <SecondaryButton>Open Test Run</SecondaryButton>
        </SurfaceCard>
      </div>

      <section className="mt-6" aria-labelledby="home-stats">
        <h2 id="home-stats" className="mb-2 text-lg font-semibold text-[var(--color-text-heading)]">
          Spaces
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Personal", "3 protocols"],
            ["Kairos app", "12 protocols"],
            ["Shared team", "8 protocols"],
          ].map(([title, value]) => (
            <div
              key={title}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4"
            >
              <div className="text-2xl font-semibold text-[var(--color-text-heading)]">{value.split(" ")[0]}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{title}</div>
              <div className="mt-2 text-sm text-[var(--color-text-muted)]">{value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const MOCK_BROWSE_LABELS = [
  "Deploy and test workflow",
  "Bug triage and escalation",
  "Skill authoring review",
  "AI MCP integration",
  "Workflow test harness",
];

export function BrowseTargetContent() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Browse</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Search or browse by label. The default view lists protocols by their label.
      </p>

      <section className="mb-6" aria-labelledby="browse-search-label">
        <label id="browse-search-label" className="mb-2 block font-medium text-[var(--color-text-heading)]">
          Search protocols
        </label>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            e.g. deploy and test
          </div>
          <div className="flex items-end">
            <PrimaryButton>Search</PrimaryButton>
          </div>
        </div>
      </section>

      <section aria-labelledby="browse-by-label-heading">
        <h2 id="browse-by-label-heading" className="mb-3 text-lg font-semibold text-[var(--color-text-heading)]">
          Browse by label
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Protocols listed by label. This is the default view when you open Browse.
        </p>
        <ul className="m-0 list-none space-y-2 p-0" role="list" aria-label="Protocols by label">
          {MOCK_BROWSE_LABELS.map((label) => (
            <li
              key={label}
              className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-[var(--color-text-heading)]">{label}</span>
              <div className="flex-shrink-0">
                <PrimaryButton>View</PrimaryButton>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ProtocolDetailTargetContent() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Deploy and test workflow</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="m-0 text-sm text-[var(--color-text-muted)]">
          <code className="break-all rounded bg-[var(--color-surface-elevated)] px-2 py-0.5 text-xs">{MOCK_URI}</code>
          <span className="ml-2">· Read-only</span>
        </p>
        <SecondaryButton>Copy URI</SecondaryButton>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <PrimaryButton>Test Run</PrimaryButton>
        <SecondaryButton>Edit</SecondaryButton>
        <SecondaryButton>Duplicate</SecondaryButton>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <SurfaceCard
          title="How to use this protocol"
          subtitle="Use Test Run from the button above to step through this protocol in the browser. For agents or CLI, use Cursor (MCP) or the command line."
        >
          <p className="text-sm text-[var(--color-text-muted)]">
            The public UI helps people read, edit, export, and manually test protocol steps. Live AI execution still happens through MCP or CLI tooling.
          </p>
        </SurfaceCard>
        <SurfaceCard title="Export" subtitle="Clear language replaces internal dump terminology.">
          <ExportMenuMock />
        </SurfaceCard>
      </div>

      <section className="mb-6" aria-labelledby="flow-heading">
        <h2 id="flow-heading" className="mb-2 text-lg font-semibold text-[var(--color-text-heading)]">
          Step flow
        </h2>
        <StepFlowGraph steps={MOCK_STEPS.map((s) => ({ label: s.label }))} />
      </section>

      <section aria-labelledby="steps-heading" className="mb-6">
        <h2 id="steps-heading" className="mb-2 text-lg font-semibold text-[var(--color-text-heading)]">
          Steps
        </h2>
        <ul className="m-0 list-none divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-0">
          {MOCK_STEPS.map((step, i) => (
            <li key={step.label} className="p-4">
              <strong className="block text-[var(--color-text-heading)]">{i + 1}. {step.label}</strong>
              <div className="mt-1 text-sm text-[var(--color-text-muted)]">{step.summary}</div>
              <div className="mt-3">
                <ChallengeCard type={step.type} payload={step.payload} />
              </div>
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <RenderedContentMock
                  intro={step.body.intro}
                  bullets={step.body.bullets}
                  code={step.body.code}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard title="Natural language triggers">
          <p className="m-0 text-sm text-[var(--color-text)]">deploy and test, run tests and deploy, release a build after checks pass</p>
        </SurfaceCard>
        <SurfaceCard title="Completion rule">
          <p className="m-0 text-sm text-[var(--color-text)]">Complete when each step is verified and the final reward records the release outcome.</p>
        </SurfaceCard>
      </div>
    </div>
  );
}

export function RunsTargetContent() {
  const mockSessions = [
    {
      id: "run-1",
      adapterUri: "kairos://adapter/abc123",
      status: "running",
      updatedAt: "Mar 13, 2026, 10:24",
      stepsDone: 2,
      message: "Contract ready for the Run tests layer.",
    },
    {
      id: "run-2",
      adapterUri: "kairos://adapter/skill-xyz",
      status: "ready_to_reward",
      updatedAt: "Mar 12, 2026, 18:02",
      stepsDone: 4,
      message: "All steps completed. Submit the final reward.",
    },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Test Run</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Continue a test run you started earlier on this device.
      </p>

      <ul className="m-0 list-none space-y-3 p-0" aria-label="Test Run list">
        {mockSessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-[var(--color-text-heading)]">{session.adapterUri}</div>
              <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                Status: {session.status} · Updated: {session.updatedAt} · {session.stepsDone} steps completed
              </div>
              <div className="mt-1 text-sm text-[var(--color-text-muted)]">{session.message}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton>Resume</PrimaryButton>
              <SecondaryButton>Remove</SecondaryButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProtocolEditTargetContent() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Edit protocol</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Write as a human. The editor renders text on input and output while keeping the saved format compatible with generic Markdown.
      </p>

      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-[var(--color-text-heading)]">Import existing content</div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Uploading a `.md` file fills this editor form. It does not publish or overwrite anything until you save.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton>Upload .md</SecondaryButton>
            <SecondaryButton>Edit as Skill</SecondaryButton>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block font-medium text-[var(--color-text-heading)]">Protocol label</label>
            <div className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)]">
              Deploy and test workflow
            </div>
          </div>

          <RichTextEditorDemo
            label="Natural language triggers"
            hint="Shown to humans as rendered text and serialized as Markdown-compatible content."
            markdown={`- Deploy and test\n- Run tests and deploy\n- Release a build after checks pass`}
          />

          <StepEditorCard
            stepNumber={1}
            label="Build"
            type="shell"
            challengeFields={[
              { label: "Command", value: "npm run build" },
              { label: "Expected proof type", value: "Shell result" },
            ]}
            bodyMarkdown={`Build the app and confirm the output directory contains the generated assets.\n\n- Run the build command\n- Check the output directory\n- Capture the actual exit code\n\n\`\`\`\nnpm run build\n\`\`\``}
          />

          <StepEditorCard
            stepNumber={2}
            label="Run tests"
            type="shell"
            challengeFields={[
              { label: "Command", value: "npm test" },
              { label: "Expected proof type", value: "Shell result" },
            ]}
            bodyMarkdown={`Execute the automated tests and review failures before continuing.\n\n- Run the test command\n- Paste stdout and stderr into testing\n- Do not proceed on failure\n\n\`\`\`\nnpm test\n\`\`\``}
          />

          <StepEditorCard
            stepNumber={3}
            label="Deploy"
            type="comment"
            challengeFields={[
              { label: "Minimum length", value: "50 characters" },
              { label: "Purpose", value: "Attest rollout outcome" },
            ]}
            bodyMarkdown={`Summarize the rollout result so operators can understand what changed and what still needs monitoring.\n\n- State where the release went\n- Mention verification results\n- Call out any follow-up`}
          />

          <SecondaryButton>Add step</SecondaryButton>

          <RichTextEditorDemo
            label="Completion rule"
            markdown={`Complete when each step is verified and the final reward records the release outcome.`}
          />

          <div className="flex flex-wrap gap-2">
            <PrimaryButton>Save</PrimaryButton>
            <SecondaryButton>Cancel</SecondaryButton>
          </div>
        </div>

        <div className="space-y-4">
          <SurfaceCard
            title="Rendered preview"
            subtitle="Users see rendered text rather than raw Markdown in both editing and reading flows."
          >
            <div className="text-lg font-semibold text-[var(--color-text-heading)]">Deploy and test workflow</div>
            <div className="mt-3 space-y-3">
              {MOCK_STEPS.map((step, index) => (
                <div key={step.label} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="font-medium text-[var(--color-text-heading)]">
                    Step {index + 1}: {step.label}
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-text-muted)]">{CHALLENGE_TYPE_LABEL[step.type]}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Skill bundle shortcut"
            subtitle="Authors can turn a protocol into a reusable skill bundle without learning repo-internal file names."
          >
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="font-medium text-[var(--color-text-heading)]">deploy-and-test-skill/</div>
              <div className="mt-2 font-mono text-sm text-[var(--color-text-muted)]">
                Skill.md
                <br />
                references/
                <br />
                &nbsp;&nbsp;KAIROS.md
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton>Edit as Skill</SecondaryButton>
              <PrimaryButton>Download as Skill</PrimaryButton>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

export function SkillBundleTargetContent() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">Edit as Skill</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Prepare a skill bundle for external AI tools before downloading the zip. Protocol content stays connected to the original workflow.
      </p>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block font-medium text-[var(--color-text-heading)]">Skill name</label>
            <div className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)]">
              Deploy and Test Skill
            </div>
          </div>

          <RichTextEditorDemo
            label="Skill description"
            hint="Describe what the skill does and when an AI assistant should use it."
            markdown={`Guide an agent through building, testing, and documenting a release.\n\nUse when the request involves releasing code after validation steps.`}
          />

          <RichTextEditorDemo
            label="When to use it"
            markdown={`- Deploy and test\n- Run tests before deployment\n- Prepare a release workflow`}
          />

          <SurfaceCard title="Bundle contents" subtitle="Optional protocol references can be included in a dedicated folder.">
            <div className="flex flex-wrap gap-2">
              <FilterChip label="Include references folder" active={true} />
              <FilterChip label="Include README snippet" />
              <FilterChip label="Include example prompts" />
            </div>
          </SurfaceCard>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton>Download as Skill</PrimaryButton>
            <SecondaryButton>Back to protocol</SecondaryButton>
          </div>
        </div>

        <div className="space-y-4">
          <SurfaceCard title="Bundle preview" subtitle="Zip root contains the skill folder so users can upload it directly.">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)]">
              deploy-and-test-skill.zip
              <br />
              └── deploy-and-test-skill/
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── Skill.md
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;└── references/
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── KAIROS.md
            </div>
          </SurfaceCard>

          <SurfaceCard title="Why this export exists" subtitle="The bundle is for human-friendly reuse, not an internal raw dump.">
            <p className="text-sm text-[var(--color-text-muted)]">
              Authors can package a protocol as a portable skill with polished naming and usage guidance, then download the final zip in one step.
            </p>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

export { RunGuidedTargetContent } from "./RunGuidedTargetMock";