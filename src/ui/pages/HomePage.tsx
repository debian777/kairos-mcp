import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useSpaces } from "@/hooks/useSpaces";

/**
 * Home page per mockup 01-home-search: overview, search form (submits to KAIROS),
 * space protocol counts, and CTA to KAIROS. No search results here.
 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useSpaces();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.querySelector('input[name="q"]') as HTMLInputElement)?.value?.trim() ?? "";
    navigate(q ? `/kairos?q=${encodeURIComponent(q)}` : "/kairos");
  };

  const spaces = data?.spaces ?? [];
  const showPlaceholder = isLoading || isError || spaces.length === 0;

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">
        {t("home.title")}
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">
        {t("home.tagline")}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 max-w-xl"
        aria-label={t("home.searchLabel")}
      >
        <label
          htmlFor="home-search-query"
          className="block font-medium text-[var(--color-text-heading)] mb-2"
        >
          {t("home.searchLabel")}
        </label>
        <input
          id="home-search-query"
          name="q"
          type="search"
          autoComplete="off"
          placeholder={t("home.searchPlaceholder")}
          aria-describedby="home-search-hint"
          className="w-full min-h-[44px] px-4 py-2 border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        />
        <p id="home-search-hint" className="text-sm text-[var(--color-text-muted)] mt-2">
          {t("home.searchHint")}
        </p>
      </form>

      <div
        className="flex gap-4 flex-wrap mb-8"
        aria-label={t("home.statsLabel")}
      >
        {showPlaceholder && spaces.length === 0 ? (
          <div className="min-w-[7rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5">
            <span className="text-2xl font-semibold text-[var(--color-text-heading)]">—</span>
            <span className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mt-1">
              {t("home.stats.spacesLabel")}
            </span>
          </div>
        ) : null}
        {spaces.map((space) => (
          <div
            key={space.name}
            className="min-w-[7rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5"
          >
            <span className="text-2xl font-semibold text-[var(--color-text-heading)]">
              {isLoading ? "—" : space.chain_count}
            </span>
            <span className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mt-1">
              {space.name}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-[var(--color-text-muted)]">
        {t("home.ctaPre")}{" "}
        <Link
          to="/kairos"
          className="text-[var(--color-primary)] font-medium underline hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("nav.kairos")}
        </Link>
        {t("home.ctaSuffix")}
      </p>
    </div>
  );
}
