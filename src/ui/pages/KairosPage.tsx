import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useSearch } from "@/hooks/useSearch";
import { ErrorAlert } from "@/components/ErrorAlert";
import { SearchResultsSkeleton } from "@/components/SearchResultsSkeleton";

/** Role badge colors matching mockup 07 (match=green, refine=blue, create=amber). */
const roleBadgeClass: Record<string, string> = {
  match: "bg-[#dcfce7] text-[#166534]",
  refine: "bg-[#dbeafe] text-[#1e40af]",
  create: "bg-[#fef3c7] text-[#92400e]",
};

export function KairosPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const { data, isLoading, isError, error, refetch } = useSearch(submittedQuery, !!submittedQuery);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setQuery(q);
    setSubmittedQuery(q);
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(query);
    setSearchParams(query ? { q: query } : {}, { replace: true });
  };

  const choicesRaw = data?.choices ?? [];
  const roleOrder: Record<string, number> = { match: 0, refine: 1, create: 2 };
  const choices = choicesRaw
    .slice()
    .sort((a, b) => {
      const ro = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      if (ro !== 0) return ro;
      const as = a.score ?? -1;
      const bs = b.score ?? -1;
      return bs - as;
    });
  const topScore =
    choices.length > 0
      ? Math.max(...choices.map((c) => (c.score != null ? c.score * 100 : 0)))
      : null;

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-4">
        {t("kairos.title")}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6"
        aria-label={t("kairos.searchLabel")}
      >
        <label
          htmlFor="kairos-search-query"
          className="block font-medium text-[var(--color-text-heading)] mb-2"
        >
          {t("kairos.searchLabel")}
        </label>
        <input
          id="kairos-search-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("kairos.searchPlaceholder")}
          aria-describedby="kairos-search-hint"
          className="w-full min-h-[44px] px-4 py-2 border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        />
        <p id="kairos-search-hint" className="text-sm text-[var(--color-text-muted)] mt-2">
          {t("kairos.searchHint")}
        </p>
        <button
          type="submit"
          className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("kairos.search")}
        </button>
      </form>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
          showGoBack={true}
        />
      )}

      {isLoading && submittedQuery && (
        <div className="mb-4" aria-live="polite" aria-busy="true">
          <p className="sr-only">{t("kairos.loading")}</p>
          <SearchResultsSkeleton />
        </div>
      )}

      {!isLoading && !isError && submittedQuery && (
        <>
          {choices.length === 0 ? (
            <div
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6"
              role="status"
              aria-live="polite"
            >
              <p className="text-[var(--color-text-muted)] mb-4">{t("kairos.empty")}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/kairos"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("kairos.refineSearch")}
                </Link>
                <Link
                  to="/protocols/new"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("kairos.createNew")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {choices.length > 0 && (
                <p
                  id="kairos-results-summary"
                  className="text-sm text-[var(--color-text-muted)] mb-4"
                  aria-live="polite"
                  role="status"
                >
                  {t("kairos.foundMatches", {
                    count: choices.length,
                    top: topScore != null ? Math.round(topScore) : 0,
                  })}
                </p>
              )}
              <ul className="list-none p-0 m-0 space-y-2" role="list" aria-label={t("kairos.resultsLabel")}>
                {choices.map((choice) => (
                  <li
                    key={choice.uri}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 flex justify-between items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[var(--color-text-heading)] block">
                        {choice.label}
                      </span>
                      <div className="text-sm text-[var(--color-text-muted)] mt-1">
                        {choice.chain_label ?? (choice.role === "refine" ? t("kairos.refineMeta") : choice.role === "create" ? t("kairos.createMeta") : "")}
                        {choice.score != null && ` · ${t("kairos.score")}: ${Math.round(choice.score * 100)}%`}
                        {choice.protocol_version && ` · ${t("kairos.version")}: ${choice.protocol_version}`}
                      </div>
                      <span
                        className={`inline-block mt-1 text-xs uppercase tracking-wide px-2 py-0.5 rounded ${roleBadgeClass[choice.role] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]"}`}
                        aria-label={`Role: ${choice.role}`}
                      >
                        {choice.role}
                      </span>
                      {choice.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2" aria-label={t("kairos.tagsLabel")}>
                          {choice.tags.slice(0, 8).map((tag) => (
                            <span
                              key={tag}
                              className="inline-block text-xs px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {choice.role === "match" && (
                        <Link
                          to={`/protocols/${encodeURIComponent(choice.uri)}`}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                        >
                          {t("kairos.view")}
                        </Link>
                      )}
                      {choice.role === "refine" && (
                        <Link
                          to={`/protocols/${encodeURIComponent(choice.uri)}`}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                        >
                          {t("kairos.refineSearch")}
                        </Link>
                      )}
                      {choice.role === "create" && (
                        <Link
                          to="/protocols/new"
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                        >
                          {t("kairos.createNew")}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
