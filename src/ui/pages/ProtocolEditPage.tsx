import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { parseProtocolMarkdown, useProtocol } from "@/hooks/useProtocol";
import { apiFetch } from "@/lib/api";

const markdownSchema = z
  .string()
  .min(1, "Protocol content is required")
  .refine((s) => s.includes("# "), "Protocol must have an H1 title")
  .refine((s) => /(^|\n)##\s+Natural language triggers\b/i.test(s), 'Include a "Natural language triggers" section (H2)')
  .refine((s) => /(^|\n)##\s+Completion rule\b/i.test(s), 'Include a "Completion rule" section (H2)');

const MINIMAL_TEMPLATE = `# My protocol

## Natural language triggers

Describe when this protocol should run (e.g. "deploy and test").

## Step 1

What the user or agent does in this step.

\`\`\`json
{"challenge": {"type": "comment", "comment": {"min_length": 10}}}
\`\`\`

## Completion Rule

When is this protocol considered complete?
`;

export function ProtocolEditPage() {
  const { t } = useTranslation();
  const { uri } = useParams<{ uri: string }>();
  const navigate = useNavigate();
  const decodedUri = uri ? decodeURIComponent(uri) : undefined;
  const isNew = !decodedUri;

  const { data, isLoading: loadingExisting } = useProtocol(decodedUri, !isNew);
  const [markdown, setMarkdown] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => {
    try {
      return parseProtocolMarkdown(markdown);
    } catch {
      return { title: "Protocol", steps: [], triggers: "", completion: "" };
    }
  }, [markdown]);

  useEffect(() => {
    if (data?.markdown_doc) setMarkdown(data.markdown_doc);
  }, [data]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setMarkdown(text);
      setValidationError(null);
      setError(null);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const insertTemplate = () => {
    if (textareaRef.current) {
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = markdown.slice(0, start);
      const after = markdown.slice(end);
      const insert = markdown.trim() === "" ? MINIMAL_TEMPLATE : "\n\n" + MINIMAL_TEMPLATE;
      setMarkdown(before + insert + after);
      setValidationError(null);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + insert.length, start + insert.length);
      }, 0);
    } else {
      setMarkdown((m) => (m.trim() === "" ? MINIMAL_TEMPLATE : m + "\n\n" + MINIMAL_TEMPLATE));
      setValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);
    const parsed = markdownSchema.safeParse(markdown);
    if (!parsed.success) {
      setValidationError(parsed.error.errors[0]?.message ?? "Invalid");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await apiFetch("/api/kairos_mint/raw", {
          method: "POST",
          headers: { "Content-Type": "text/markdown" },
          body: markdown,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? res.statusText);
        }
        const json = await res.json();
        const firstUri = (json as { items?: { uri?: string }[] }).items?.[0]?.uri;
        if (firstUri) navigate(`/protocols/${encodeURIComponent(firstUri)}`);
        else navigate("/");
      } else {
        const res = await apiFetch("/api/kairos_update", {
          method: "POST",
          body: JSON.stringify({ uris: [decodedUri], markdown_doc: [markdown] }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? res.statusText);
        }
        navigate(`/protocols/${encodeURIComponent(decodedUri!)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && loadingExisting && !data) {
    return <p className="text-[var(--color-text-muted)]">{t("protocol.loading")}</p>;
  }

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">
        {isNew ? t("protocolEdit.newTitle") : t("protocolEdit.editTitle")}
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        {t("protocolEdit.hint")}
      </p>

      <form onSubmit={handleSubmit} aria-label={t("protocolEdit.formLabel")}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label htmlFor="protocol-markdown" className="block font-medium text-[var(--color-text-heading)]">
                {t("protocolEdit.contentLabel")}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,text/markdown"
                  onChange={handleUpload}
                  className="sr-only"
                  id="protocol-upload"
                  aria-label={t("protocolEdit.upload")}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("protocolEdit.upload")}
                </button>
                <button
                  type="button"
                  onClick={insertTemplate}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("protocolEdit.insertTemplate")}
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              id="protocol-markdown"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={t("protocolEdit.placeholder")}
              aria-describedby="content-hint content-error"
              aria-invalid={Boolean(validationError)}
              className="w-full min-h-[18rem] px-4 py-3 border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] bg-[var(--color-surface)] font-mono text-sm resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
            />
            <p id="content-hint" className="text-sm text-[var(--color-text-muted)] mt-2">
              {t("protocolEdit.contentHint")}
            </p>
            {validationError && (
              <p id="content-error" className="text-sm text-[var(--color-error)] mt-2" role="alert">
                {validationError}
              </p>
            )}
          </div>

          <div aria-label={t("protocolEdit.previewLabel")}>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
              <div className="text-sm text-[var(--color-text-muted)]">{t("protocolEdit.previewTitle")}</div>
              <div className="text-lg font-semibold text-[var(--color-text-heading)] mt-1">{preview.title}</div>
              <div className="mt-4">
                <div className="text-sm font-medium text-[var(--color-text-heading)] mb-2">{t("protocolEdit.previewSteps")}</div>
                {preview.steps.length === 0 ? (
                  <div className="text-sm text-[var(--color-text-muted)]">{t("protocolEdit.previewNoSteps")}</div>
                ) : (
                  <ul className="list-none p-0 m-0 space-y-2">
                    {preview.steps.slice(0, 20).map((s, idx) => (
                      <li key={`${s.label}:${idx}`} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="font-medium text-[var(--color-text-heading)]">{s.label}</div>
                        <div className="text-sm text-[var(--color-text-muted)] mt-1">{s.summary}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-4">
                <div className="text-sm font-medium text-[var(--color-text-heading)] mb-2">{t("protocolEdit.previewSections")}</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  <div>
                    <strong className="text-[var(--color-text-heading)]">{t("protocol.triggers")}:</strong>{" "}
                    {preview.triggers ? t("protocolEdit.present") : t("protocolEdit.missing")}
                  </div>
                  <div className="mt-1">
                    <strong className="text-[var(--color-text-heading)]">{t("protocol.completion")}:</strong>{" "}
                    {preview.completion ? t("protocolEdit.present") : t("protocolEdit.missing")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] text-[var(--color-error)]" role="alert">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {saving ? t("protocolEdit.saving") : t("protocolEdit.save")}
          </button>
          <Link
            to={isNew ? "/" : `/protocols/${encodeURIComponent(decodedUri!)}`}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {t("protocolEdit.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
