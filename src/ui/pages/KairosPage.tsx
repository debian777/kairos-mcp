import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useActivate } from "@/hooks/useActivate";
import { useSpaces } from "@/hooks/useSpaces";
import { ErrorAlert } from "@/components/ErrorAlert";
import { SearchResultsSkeleton } from "@/components/SearchResultsSkeleton";
import { toConfidencePercent } from "@/utils/confidence";

/** Role badge colors matching mockup 07 (match=green, refine=blue, create=amber). */
const roleBadgeClass: Record<string, string> = {
  match: "bg-[#dcfce7] text-[#166534]",
  refine: "bg-[#dbeafe] text-[#1e40af]",
  create: "bg-[#fef3c7] text-[#92400e]",
};

const A_Z = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Adapter URI prefix for chain_id from spaces browse results. */
const PROTOCOL_URI_PREFIX = "kairos://adapter/";

export function KairosPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useActivate(submittedQuery, !!submittedQuery);
  const showBrowse = !submittedQuery;
  const {
    data: spacesData,
    isLoading: spacesLoading,
    isError: spacesError,
    error: spacesErrorDetail,
    refetch: refetchSpaces,
  } = useSpaces(showBrowse, { includeChainTitles: true });

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
      const as = a.activation_score ?? -1;
      const bs = b.activation_score ?? -1;
      return bs - as;
    });
  const topScore = choices.length > 0
    ? Math.max(...choices.map((c) => toConfidencePercent(c.activation_score)))
    : null;

  const { browseChains, countsByLetter } = useMemo(() => {
    const chains: Array<{ chain_id: string; title: string; step_count: number }> = [];
    for (const space of spacesData?.spaces ?? []) {
      for (const c of space.chains ?? []) {
        chains.push({ chain_id: c.chain_id, title: c.title, step_count: c.step_count });
      }
    }
    const byLetter: Record<string, number> = {};
    for (const letter of A_Z) byLetter[letter] = 0;
    for (const c of chains) {
      const first = (c.title ?? "").trim().charAt(0).toUpperCase();
      if (A_Z.includes(first)) byLetter[first] = (byLetter[first] ?? 0) + 1;
    }
    return { browseChains: chains, countsByLetter: byLetter };
  }, [spacesData?.spaces]);

  const letterChains = useMemo(() => {
    if (!expandedLetter) return [];
    return browseChains.filter((c) => {
      const first = (c.title ?? "").trim().charAt(0).toUpperCase();
      return first === expandedLetter;
    });
  }, [browseChains, expandedLetter]);

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">
        {t("kairos.title")}
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">
        {t("kairos.searchHint")}
      </p>

      <section className="mb-8" aria-labelledby="browse-search-label">
        <h2 id="browse-search-label" className="sr-only">
          {t("kairos.searchLabel")}
        </h2>
      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-xl"
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
      </section>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
          showGoBack={true}
        />
      )}

      {showBrowse && spacesError && (
        <ErrorAlert
          message={spacesErrorDetail instanceof Error ? spacesErrorDetail.message : String(spacesErrorDetail)}
          onRetry={() => refetchSpaces()}
          showGoBack={true}
        />
      )}

      {isLoading && submittedQuery && (
        <div className="mb-4" aria-live="polite" aria-busy="true">
          <p className="sr-only">{t("kairos.loading")}</p>
          <SearchResultsSkeleton />
        </div>
      )}

      {showBrowse && spacesLoading && (
        <div className="mb-4" aria-live="polite" aria-busy="true">
          <p className="sr-only">{t("kairos.loading")}</p>
          <SearchResultsSkeleton />
        </div>
      )}

      {!isLoading && !isError && !(showBrowse && spacesError) && (
        <>
          {!submittedQuery ? (
            <section aria-labelledby="browse-by-label-heading">
              <h2 id="browse-by-label-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-3">
                {t("kairos.browseByLabel")}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                {t("kairos.browseByLetterHint")}
              </p>
              {!spacesLoading && (
              <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label={t("kairos.browseByLabel")}>
                {A_Z.map((letter) => {
                  const count = countsByLetter[letter] ?? 0;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setExpandedLetter((prev) => (prev === letter ? null : letter))}
                      aria-expanded={expandedLetter === letter}
                      aria-controls={`browse-letter-panel-${letter}`}
                      aria-pressed={expandedLetter === letter}
                      aria-label={t("kairos.letterCount", { letter, count })}
                      className={`min-h-[var(--layout-touch-target)] min-w-[var(--layout-touch-target)] inline-flex items-center justify-center rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2 ${
                        expandedLetter === letter
                          ? "border-[var(--color-primary)] bg-[var(--color-surface-elevated)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
                      }`}
                    >
                      {letter}: {count}
                    </button>
                  );
                })}
              </div>
              )}
              {expandedLetter && !spacesLoading && (
                <div
                  id={`browse-letter-panel-${expandedLetter}`}
                  role="region"
                  aria-labelledby="browse-letter-panel-heading"
                  aria-live="polite"
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5"
                >
                  <h3 id="browse-letter-panel-heading" className="text-base font-semibold text-[var(--color-text-heading)] mb-3">
                    {t("kairos.labelsStartingWith", { letter: expandedLetter })}
                  </h3>
                  {letterChains.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">{t("kairos.noLabelsForLetter")}</p>
                  ) : (
                    <ul
                      className="list-none p-0 m-0 space-y-2"
                      role="list"
                      aria-label={t("kairos.labelsStartingWith", { letter: expandedLetter })}
                    >
                      {letterChains.map((chain) => {
                        const uri = `${PROTOCOL_URI_PREFIX}${chain.chain_id}`;
                        return (
                          <li
                            key={chain.chain_id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                          >
                            <span className="font-medium text-[var(--color-text-heading)]">{chain.title}</span>
                            <Link
                              to={`/protocols/${encodeURIComponent(uri)}`}
                              aria-label={t("kairos.viewProtocol", { title: chain.title })}
                              className="min-h-[var(--layout-touch-target)] min-w-[var(--layout-touch-target)] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                            >
                              {t("kairos.view")}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          ) : choices.length === 0 ? (
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
          ) : submittedQuery ? (
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
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 flex justify-between items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[var(--color-text-heading)] block">
                        {choice.label}
                      </span>
                      <div className="text-sm text-[var(--color-text-muted)] mt-1">
                        {choice.adapter_name ?? (choice.role === "refine" ? t("kairos.refineMeta") : choice.role === "create" ? t("kairos.createMeta") : "")}
                        {choice.activation_score != null && ` · ${t("kairos.score")}: ${toConfidencePercent(choice.activation_score)}%`}
                        {choice.adapter_version && ` · ${t("kairos.version")}: ${choice.adapter_version}`}
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
                          aria-label={t("kairos.viewProtocol", { title: choice.label })}
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
          ) : null}
        </>
      )}
    </div>
  );
}
