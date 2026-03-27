import { useTranslation } from "react-i18next";
import { useMe } from "@/hooks/useAuth";
import type { MeResponse } from "@/hooks/useAuth";

function displayName(data: MeResponse): string {
  if (data.name && data.name.trim().length > 0) return data.name;
  const parts = [data.given_name, data.family_name].filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  if (parts.length > 0) return parts.join(" ");
  if (data.preferred_username && data.preferred_username.length > 0) return data.preferred_username;
  return data.sub;
}

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
          className="mt-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
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
          <span className="text-[var(--color-text-heading)]">{displayName(data)}</span>
        </div>
        {data.preferred_username && data.preferred_username !== displayName(data) && (
          <div className="mb-4">
            <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              {t("account.username")}
            </span>
            <span className="text-[var(--color-text-heading)]">{data.preferred_username}</span>
          </div>
        )}
        {data.email && (
          <div className="mb-4">
            <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              {t("account.email")}
            </span>
            <span className="text-[var(--color-text-heading)]">
              {data.email}
              {data.email_verified === true ? ` (${t("account.emailVerified")})` : ""}
            </span>
          </div>
        )}
        <div className="mb-4">
          <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            {t("account.accountType")}
          </span>
          <span className="text-[var(--color-text-heading)]">{data.account_label}</span>
        </div>
        <div className="mb-4">
          <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            {t("account.realm")}
          </span>
          <span className="text-[var(--color-text-heading)]">{data.realm}</span>
        </div>
        {data.identity_provider && (
          <div className="mb-4">
            <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              {t("account.identityProvider")}
            </span>
            <span className="text-[var(--color-text-heading)]">{data.identity_provider}</span>
          </div>
        )}
        {data.groups.length > 0 && (
          <div className="mb-4">
            <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              {t("account.groups")}
            </span>
            <ul className="list-disc list-inside text-[var(--color-text-heading)] space-y-1">
              {data.groups.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
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
