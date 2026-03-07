import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export interface ErrorAlertProps {
  /** Main error message (e.g. from API or 404) */
  message: string;
  /** Optional next_action from API */
  nextAction?: string;
  /** Callback when user clicks Retry */
  onRetry?: () => void;
  /** Show "Go to Home" link */
  showGoBack?: boolean;
  /** Optional support link */
  supportLink?: string;
}

export function ErrorAlert({
  message,
  nextAction,
  onRetry,
  showGoBack = true,
  supportLink,
}: ErrorAlertProps) {
  const { t } = useTranslation();
  return (
    <div
      className="p-4 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-error-bg)]"
      role="alert"
    >
      <h2 className="text-base font-semibold text-[var(--color-error)] mb-2">
        {t("error.title")}
      </h2>
      <p className="text-[var(--color-text)]">{message}</p>
      {nextAction && (
        <p className="mt-4 pt-4 border-t border-[var(--color-border)] font-medium">
          {nextAction}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-4">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer"
          >
            {t("error.retry")}
          </button>
        )}
        {showGoBack && (
          <Link
            to="/"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline"
          >
            {t("error.goBack")}
          </Link>
        )}
        {supportLink && (
          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline"
          >
            {t("error.support")}
          </a>
        )}
      </div>
    </div>
  );
}
