import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProtocol, parseProtocolMarkdown } from "@/hooks/useProtocol";
import { CopyButton } from "@/components/CopyButton";
import { RenderedMarkdown } from "@/components/RenderedMarkdown";

const typeBadgeClass: Record<string, string> = {
  shell: "bg-[#fef3c7] text-[#92400e]",
  mcp: "bg-[#dbeafe] text-[#1e40af]",
  user_input: "bg-[#ede9fe] text-[#5b21b6]",
  comment: "bg-[#e2e8f0] text-[#334155]",
};

const challengeTypeLabel: Record<string, string> = {
  shell: "Shell command",
  mcp: "MCP tool call",
  user_input: "User input",
  comment: "Comment",
};

export function ProtocolDetailPage() {
  const { t } = useTranslation();
  const { uri } = useParams<{ uri: string }>();
  const decodedUri = uri ? decodeURIComponent(uri) : undefined;
  const { data, isLoading, isError, error } = useProtocol(decodedUri, true);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [exportOpen]);

  if (isLoading && !data) {
    return <p className="text-[var(--color-text-muted)]">{t("protocol.loading")}</p>;
  }
  if (isError || !data) {
    return (
      <div role="alert" className="p-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] text-[var(--color-error)]">
        {error instanceof Error ? error.message : t("protocol.notFound")}
        <Link
          to="/"
          className="block mt-2 text-[var(--color-primary)] underline hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("notFound.goHome")}
        </Link>
      </div>
    );
  }

  const { title, steps, triggers, completion } = parseProtocolMarkdown(data.markdown_doc);

  const handleDownloadMarkdown = () => {
    const safeName = title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "protocol";
    const blob = new Blob([data.markdown_doc], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleDownloadSkill = () => {
    const safeName = title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "protocol";
    const skillMd = `# ${title}\n\n${data.markdown_doc}`;
    const blob = new Blob([skillMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}-skill.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-3">
        {title}
      </h1>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <p className="text-sm text-[var(--color-text-muted)] m-0">
          <span className="sr-only">{t("protocol.uri")}: </span>
          <code className="text-xs bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded break-all">{data.uri}</code>
          <span className="ml-2">· {t("protocol.readOnly")}</span>
          {data.space_name != null && data.space_name.length > 0 ? (
            <span className="ml-2 block w-full sm:inline sm:w-auto">
              · {t("protocol.spaceLabel")}: {data.space_name}
            </span>
          ) : null}
        </p>
        <CopyButton
          value={data.uri}
          label={t("protocol.copyUri")}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        />
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((o) => !o)}
            aria-expanded={exportOpen}
            aria-haspopup="true"
            aria-label={t("protocol.download")}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {t("protocol.download")}
          </button>
          {exportOpen && (
            <div
              className="absolute left-0 top-full z-10 mt-1 min-w-[12rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-sm"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleDownloadMarkdown}
                className="flex w-full min-h-[44px] items-center justify-between px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus:bg-[var(--color-surface-elevated)] focus:outline-none"
              >
                {t("protocol.downloadAsMarkdown")}
                <span className="text-[var(--color-text-muted)]">.md</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleDownloadSkill}
                className="flex w-full min-h-[44px] items-center justify-between px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus:bg-[var(--color-surface-elevated)] focus:outline-none"
              >
                {t("protocol.downloadAsSkill")}
                <span className="text-[var(--color-text-muted)]">.md</span>
              </button>
            </div>
          )}
        </div>
        <Link
          to={`/protocols/${encodeURIComponent(data.uri)}/skill`}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("protocol.editAsSkill")}
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          to={`/protocols/${encodeURIComponent(data.uri)}/run`}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white no-underline hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("protocol.runGuided")}
        </Link>
        <Link
          to={`/protocols/${encodeURIComponent(data.uri)}/edit`}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("protocol.edit")}
        </Link>
        <Link
          to="/protocols/new"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("protocol.duplicate")}
        </Link>
      </div>

      <section aria-labelledby="steps-heading" className="mb-8">
        <h2 id="steps-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          {t("protocol.steps")}
        </h2>
        <ul className="list-none p-0 m-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] divide-y divide-[var(--color-border)]">
          {steps.map((step, i) => (
            <li key={i} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--color-text)]">
                    Step {i + 1}: {step.label}
                  </span>
                  <div className="text-sm text-[var(--color-text-muted)] mt-1 break-words">
                    {step.summary}
                  </div>
                  <span
                    className={`inline-block mt-1 text-xs uppercase tracking-wide px-2 py-0.5 rounded ${typeBadgeClass[step.type] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]"}`}
                    aria-label={`Challenge type: ${challengeTypeLabel[step.type] ?? step.type}`}
                  >
                    {challengeTypeLabel[step.type] ?? step.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CopyButton
                    value={step.body || step.summary}
                    label={`${t("run.copy")} ${step.label}`}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                  />
                  {step.body ? (
                    <button
                      type="button"
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                      aria-expanded={expandedStep === i}
                      aria-controls={`step-detail-${i}`}
                      id={`step-toggle-${i}`}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                    >
                      {expandedStep === i ? t("protocol.collapse") : t("protocol.expand")}
                    </button>
                  ) : null}
                </div>
              </div>
              {step.body ? (
                <div
                  id={`step-detail-${i}`}
                  role="region"
                  aria-labelledby={`step-toggle-${i}`}
                  hidden={expandedStep !== i}
                  className="mt-3 pt-3 border-t border-[var(--color-border)]"
                >
                  <RenderedMarkdown content={step.body} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {triggers && (
        <section aria-labelledby="triggers-heading" className="mb-8">
          <h2 id="triggers-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("protocol.triggers")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <RenderedMarkdown content={triggers} />
          </div>
        </section>
      )}

      {completion && (
        <section aria-labelledby="completion-heading" className="mb-8">
          <h2 id="completion-heading" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("protocol.completion")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <RenderedMarkdown content={completion} />
          </div>
        </section>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 mt-8" role="region" aria-labelledby="how-to-use-heading">
        <h2 id="how-to-use-heading" className="text-base font-semibold text-[var(--color-text-heading)] mb-2">
          {t("protocol.howToUse")}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">
          {t("protocol.howToUseInProduct")}
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t("protocol.howToUseCopy")}{" "}
          <a
            href="https://github.com/debian777/kairos-mcp#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-primary)] underline hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {t("protocol.docsLink")}
          </a>
        </p>
      </div>
    </div>
  );
}
