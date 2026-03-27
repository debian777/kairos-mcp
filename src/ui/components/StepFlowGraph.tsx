export function StepFlowGraph({
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
              <span className="px-0.5 text-[var(--color-text-muted)]" aria-hidden>
                →
              </span>
            )}
            <span
              className={`inline-flex min-h-[32px] items-center justify-center rounded-[var(--radius-sm)] px-3 text-sm font-medium ${
                isCurrent
                  ? "bg-[var(--color-primary)] text-white ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-surface)]"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
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
