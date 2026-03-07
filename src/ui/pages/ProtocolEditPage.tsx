import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useProtocol } from "@/hooks/useProtocol";
import { apiFetch } from "@/lib/api";

const markdownSchema = z
  .string()
  .min(1, "Protocol content is required")
  .refine((s) => s.includes("# "), "Protocol must have an H1 title");

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

  useEffect(() => {
    if (data?.markdown_doc) setMarkdown(data.markdown_doc);
  }, [data]);

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
        <div className="mb-6">
          <label htmlFor="protocol-markdown" className="block font-medium text-[var(--color-text-heading)] mb-2">
            {t("protocolEdit.contentLabel")}
          </label>
          <textarea
            id="protocol-markdown"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={t("protocolEdit.placeholder")}
            aria-describedby="content-hint content-error"
            aria-invalid={Boolean(validationError)}
            className="w-full min-h-[12rem] px-4 py-3 border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] bg-[var(--color-surface)] font-mono text-sm resize-y"
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

        {error && (
          <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] text-[var(--color-error)]" role="alert">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer disabled:opacity-60"
          >
            {saving ? t("protocolEdit.saving") : t("protocolEdit.save")}
          </button>
          <Link
            to={isNew ? "/" : `/protocols/${encodeURIComponent(decodedUri!)}`}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline"
          >
            {t("protocolEdit.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
