import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useSearch } from "@/hooks/useSearch";
import { ErrorAlert } from "@/components/ErrorAlert";

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

  const choices = data?.choices ?? [];
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
          className="w-full min-h-[44px] px-4 py-2 border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] bg-[var(--color-surface)] focus:outline focus:outline-2 focus:outline-[var(--color-focus-ring)] focus:outline-offset-2"
        />
        <p id="kairos-search-hint" className="text-sm text-[var(--color-text-muted)] mt-2">
          {t("kairos.searchHint")}
        </p>
        <button
          type="submit"
          className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
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
        <p className="text-[var(--color-text-muted)] text-sm mb-4">{t("kairos.loading")}</p>
      )}

      {!isLoading && !isError && submittedQuery && (
        <>
          {choices.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6">
              <p className="text-[var(--color-text-muted)] mb-4">{t("kairos.empty")}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/protocols/new"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 no-underline"
                >
                  {t("kairos.createNew")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {choices.length > 0 && (
                <p className="text-sm text-[var(--color-text-muted)] mb-4">
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
                      </div>
                      <span
                        className={`inline-block mt-1 text-xs uppercase tracking-wide px-2 py-0.5 rounded ${roleBadgeClass[choice.role] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]"}`}
                        aria-label={`Role: ${choice.role}`}
                      >
                        {choice.role}
                      </span>
                    </div>
                    <div className="flex-shrink-0">
                      {choice.role === "match" && (
                        <Link
                          to={`/protocols/${encodeURIComponent(choice.uri)}`}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline"
                        >
                          {t("kairos.view")}
                        </Link>
                      )}
                      {choice.role === "refine" && (
                        <Link
                          to={`/protocols/${encodeURIComponent(choice.uri)}`}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline"
                        >
                          {t("kairos.refineSearch")}
                        </Link>
                      )}
                      {choice.role === "create" && (
                        <Link
                          to="/protocols/new"
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline"
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
