import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProtocol, parseProtocolMarkdown } from "@/hooks/useProtocol";

export function ProtocolDetailPage() {
  const { t } = useTranslation();
  const { uri } = useParams<{ uri: string }>();
  const decodedUri = uri ? decodeURIComponent(uri) : undefined;
  const { data, isLoading, isError, error } = useProtocol(decodedUri, true);

  if (isLoading && !data) {
    return <p className="text-[var(--color-text-muted)]">{t("protocol.loading")}</p>;
  }
  if (isError || !data) {
    return (
      <div role="alert" className="p-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] text-[var(--color-error)]">
        {error instanceof Error ? error.message : t("protocol.notFound")}
        <Link to="/" className="block mt-2 text-[var(--color-primary)]">
          {t("notFound.goHome")}
        </Link>
      </div>
    );
  }

  const { title, steps, triggers, completion } = parseProtocolMarkdown(data.markdown_doc);

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">
        {title}
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        {t("protocol.uri")}: {data.uri} · {t("protocol.readOnly")}
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          to={`/protocols/${encodeURIComponent(data.uri)}/edit`}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline"
        >
          {t("protocol.edit")}
        </Link>
        <Link
          to="/protocols/new"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline"
        >
          {t("protocol.duplicate")}
        </Link>
      </div>

      <section aria-labelledby="steps-heading" className="mb-6">
        <h2 id="steps-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          {t("protocol.steps")}
        </h2>
        <ul className="list-none p-0 m-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] divide-y divide-[var(--color-border)]">
          {steps.map((step, i) => (
            <li key={i} className="p-4">
              <strong>{step.label}</strong>
              <span className="text-sm text-[var(--color-text-muted)] ml-2">
                ({step.type})
              </span>
            </li>
          ))}
        </ul>
      </section>

      {triggers && (
        <section aria-labelledby="triggers-heading" className="mb-6">
          <h2 id="triggers-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("protocol.triggers")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            {triggers}
          </div>
        </section>
      )}

      {completion && (
        <section aria-labelledby="completion-heading" className="mb-6">
          <h2 id="completion-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("protocol.completion")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            {completion}
          </div>
        </section>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 mt-6">
        <strong className="block mb-1 text-[var(--color-text-heading)]">
          {t("protocol.howToUse")}
        </strong>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t("protocol.howToUseCopy")}{" "}
          <a
            href="https://github.com/debian777/kairos-mcp#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-primary)]"
          >
            {t("protocol.docsLink")}
          </a>
        </p>
      </div>
    </div>
  );
}
