/**
 * Skeleton placeholder for search results list.
 * Used while search is loading to avoid layout shift and show progress.
 */
export function SearchResultsSkeleton() {
  return (
    <ul className="list-none p-0 m-0 space-y-2" role="list" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <li
          key={i}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 flex justify-between items-start gap-4"
        >
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-5 w-3/4 rounded bg-[var(--color-border)] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[var(--color-border)] animate-pulse" />
            <div className="h-5 w-16 rounded bg-[var(--color-border)] animate-pulse" />
          </div>
          <div className="h-10 w-20 rounded-[var(--radius-md)] bg-[var(--color-border)] animate-pulse flex-shrink-0" />
        </li>
      ))}
    </ul>
  );
}
