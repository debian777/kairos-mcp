import { useTranslation } from "react-i18next";
import { useMe } from "@/hooks/useAuth";

export function AccountPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return <p className="text-[var(--color-text-muted)]">{t("account.loading")}</p>;
  }

  if (isError || !data) {
    return (
      <div>
        <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-4">
          {t("account.title")}
        </h1>
        <p className="text-[var(--color-text-muted)]">{t("account.notSignedIn")}</p>
        <a
          href="/auth/callback"
          className="mt-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline"
        >
          {t("account.signIn")}
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-6">
        {t("account.title")}
      </h1>
      <p className="text-[var(--color-text-muted)] mb-6">
        {t("account.intro")}
      </p>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6">
        <div className="mb-4">
          <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            {t("account.name")}
          </span>
          <span className="text-[var(--color-text-heading)]">{data.name ?? data.sub}</span>
        </div>
        {data.email && (
          <div className="mb-4">
            <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              {t("account.email")}
            </span>
            <span className="text-[var(--color-text-heading)]">{data.email}</span>
          </div>
        )}
        <div className="mt-6 flex gap-2 flex-wrap">
          <a
            href="/auth/logout"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] bg-transparent no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {t("account.logOut")}
          </a>
        </div>
      </div>
    </div>
  );
}
