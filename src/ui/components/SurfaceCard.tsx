import type { ReactNode } from "react";

export function SurfaceCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 ${className ?? ""}`}
    >
      <div className="mb-3">
        <h2 className="text-base font-semibold text-[var(--color-text-heading)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
