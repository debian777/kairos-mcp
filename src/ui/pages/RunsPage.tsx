import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRunSessions } from "@/hooks/useRunSession";

export function RunsPage() {
  const { t } = useTranslation();
  const { sessions, remove } = useRunSessions();

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">{t("runs.title")}</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">{t("runs.subtitle")}</p>

      {sessions.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6">
          <p className="text-[var(--color-text-muted)]">{t("runs.empty")}</p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 space-y-3" aria-label={t("runs.listLabel")}>
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium text-[var(--color-text-heading)] truncate">{s.adapter_uri}</div>
                <div className="text-sm text-[var(--color-text-muted)] mt-1">
                  {t("runs.status")}: {s.status} · {t("runs.updated")}: {new Date(s.updated_at).toLocaleString()}
                  {" · "}
                  {t("runs.stepsDone", { count: s.history.length })}
                </div>
                {s.last_message && <div className="text-sm text-[var(--color-text-muted)] mt-1">{s.last_message}</div>}
              </div>
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                <Link
                  to={`/protocols/${encodeURIComponent(s.adapter_uri)}/run?session=${encodeURIComponent(s.id)}`}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("runs.resume")}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] bg-transparent hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("runs.remove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

