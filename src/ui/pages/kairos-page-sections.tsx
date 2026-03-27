import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { TFunction } from "i18next";
import { SpaceTypeBadge } from "@/components/SpaceSelect";
import type { AdapterBrowseRow } from "@/utils/browse-adapters";
import { toConfidencePercent } from "@/utils/confidence";
import type { ActivateOutput } from "../../tools/activate_schema.js";

const PROTOCOL_URI_PREFIX = "kairos://adapter/";

type Choice = ActivateOutput["choices"][number];

/** Default Browse view: protocols sorted by label (matches Protocol UX Storybook target). */
export function KairosBrowseByLabelSection(props: {
  t: TFunction;
  spacesLoading: boolean;
  browseAdapters: AdapterBrowseRow[];
}) {
  const { t, spacesLoading, browseAdapters } = props;
  const sorted = useMemo(
    () =>
      [...browseAdapters].sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" })
      ),
    [browseAdapters]
  );

  return (
    <section aria-labelledby="browse-by-label-heading">
      <h2 id="browse-by-label-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-3">
        {t("kairos.browseByLabel")}
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{t("kairos.browseFlatListHint")}</p>
      {!spacesLoading && sorted.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t("kairos.browseEmpty")}</p>
      ) : null}
      {!spacesLoading && sorted.length > 0 ? (
        <ul className="m-0 list-none space-y-2 p-0" role="list" aria-label={t("kairos.browseByLabel")}>
          {sorted.map((adapter) => {
            const uri = `${PROTOCOL_URI_PREFIX}${adapter.adapter_id}`;
            return (
              <li
                key={adapter.adapter_id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex flex-col gap-1">
                  <span className="font-medium text-[var(--color-text-heading)]">{adapter.title}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <SpaceTypeBadge type={adapter.space_type} />
                    <span className="text-xs text-[var(--color-text-muted)]">{adapter.space_name}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Link
                    to={`/protocols/${encodeURIComponent(uri)}`}
                    aria-label={t("kairos.viewProtocol", { title: adapter.title })}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                  >
                    {t("kairos.view")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export function KairosActivateResultsSection(props: {
  t: TFunction;
  choices: Choice[];
  topScore: number | null;
  roleBadgeClass: Record<string, string>;
}) {
  const { t, choices, topScore, roleBadgeClass } = props;

  return (
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
              <span className="font-medium text-[var(--color-text-heading)] block">{choice.label}</span>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">
                {choice.adapter_name ??
                  (choice.role === "refine"
                    ? t("kairos.refineMeta")
                    : choice.role === "create"
                      ? t("kairos.createMeta")
                      : "")}
                {choice.role === "match" && choice.space_name != null && choice.space_name.length > 0 && (
                  <>
                    {" "}
                    · {t("kairos.spaceLabel")}: {choice.space_name}
                  </>
                )}
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
  );
}
