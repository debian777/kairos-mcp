const TYPE_BADGE_CLASS: Record<string, string> = {
  shell: "bg-[var(--badge-shell-bg)] text-[var(--badge-shell-fg)]",
  mcp: "bg-[var(--badge-mcp-bg)] text-[var(--badge-mcp-fg)]",
  user_input: "bg-[var(--badge-user-input-bg)] text-[var(--badge-user-input-fg)]",
  comment: "bg-[var(--badge-comment-bg)] text-[var(--badge-comment-fg)]",
};

/** Human-readable challenge names (editor mockups, previews). */
export const CHALLENGE_TYPE_LABEL: Record<string, string> = {
  shell: "Shell command",
  mcp: "MCP tool call",
  user_input: "User input",
  comment: "Comment",
};

export type ChallengePayload = {
  cmd?: string;
  tool_name?: string;
  /** Expected MCP tool arguments from the layer contract (subset match on submit). */
  arguments?: Record<string, unknown>;
  prompt?: string;
  min_length?: number;
};

export function ChallengeCard({ type, payload }: { type: string; payload?: ChallengePayload }) {
  const label = CHALLENGE_TYPE_LABEL[type] ?? type;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs uppercase tracking-wide ${TYPE_BADGE_CLASS[type] ?? "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"}`}
        >
          {label}
        </span>
      </div>
      {payload?.cmd && (
        <div className="mt-2">
          <div className="text-xs text-[var(--color-text-muted)]">Command</div>
          <code className="mt-0.5 block break-all rounded bg-[var(--color-surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-text)]">
            {payload.cmd}
          </code>
        </div>
      )}
      {payload?.tool_name && <div className="mt-2 text-sm text-[var(--color-text)]">Tool: {payload.tool_name}</div>}
      {payload?.arguments !== undefined && (
        <div className="mt-2">
          <div className="text-xs text-[var(--color-text-muted)]">Expected arguments (subset)</div>
          <code className="mt-0.5 block max-h-40 overflow-auto break-all rounded bg-[var(--color-surface-elevated)] px-3 py-2 font-mono text-xs text-[var(--color-text)]">
            {JSON.stringify(payload.arguments, null, 2)}
          </code>
        </div>
      )}
      {payload?.prompt && <div className="mt-2 text-sm text-[var(--color-text)]">{payload.prompt}</div>}
      {payload?.min_length != null && (
        <div className="mt-2 text-sm text-[var(--color-text-muted)]">Min length: {payload.min_length} chars</div>
      )}
    </div>
  );
}
