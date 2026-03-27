import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  useProtocol,
  parseProtocolMarkdown,
  parseProtocolMarkdownToForm,
  buildMarkdownFromForm,
  type ProtocolFormState,
  type StepFormState,
} from "@/hooks/useProtocol";
import { apiFetch } from "@/lib/api";
import { CHALLENGE_TYPE_LABEL } from "@/components/ChallengeCard";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SurfaceCard } from "@/components/SurfaceCard";
import { useSpaces } from "@/hooks/useSpaces";
import { SpaceSelect } from "@/components/SpaceSelect";

const markdownSchema = z
  .string()
  .min(1, "Protocol content is required")
  .refine((s) => s.includes("# "), "Protocol must have an H1 title")
  .refine((s) => /(^|\n)##\s+Natural language triggers\b/i.test(s), 'Include a "Natural language triggers" section (H2)')
  .refine((s) => /(^|\n)##\s+Completion rule\b/i.test(s), 'Include a "Completion rule" section (H2)');

const DEFAULT_STEP: StepFormState = {
  label: "Step",
  bodyMarkdown: "What the user or agent does in this step.",
  type: "comment",
  comment: { min_length: 10 },
};

const CHALLENGE_TYPE_KEYS: StepFormState["type"][] = ["shell", "mcp", "user_input", "comment"];

const SOURCE_ADAPTER_URI_RE = /^kairos:\/\/adapter\/[0-9a-f-]{36}$/i;

export function ProtocolEditPage() {
  const { t } = useTranslation();
  const { uri } = useParams<{ uri: string }>();
  const navigate = useNavigate();
  const decodedUri = uri ? decodeURIComponent(uri) : undefined;
  const isNew = !decodedUri;

  const { data, isLoading: loadingExisting } = useProtocol(decodedUri, !isNew);
  const [form, setForm] = useState<ProtocolFormState>({
    protocolLabel: "",
    triggersMarkdown: "",
    steps: [{ ...DEFAULT_STEP }],
    completionMarkdown: "",
  });
  const [uploadKey, setUploadKey] = useState(() => String(Date.now()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialSpaceIdRef = useRef<string>("");
  const [targetSpace, setTargetSpace] = useState("");
  const [moveSpace, setMoveSpace] = useState("");
  const [forkSourceUri, setForkSourceUri] = useState("");

  const { data: spacesData, isLoading: spacesLoading } = useSpaces(true, {});

  useEffect(() => {
    if (!isNew) return;
    setTargetSpace("");
    setForkSourceUri("");
  }, [isNew]);

  useEffect(() => {
    if (!isNew) return;
    const p = spacesData?.spaces?.find((s) => s.type === "personal");
    setTargetSpace((prev) => (prev === "" && p ? p.space_id : prev));
  }, [isNew, spacesData?.spaces]);

  useEffect(() => {
    if (isNew || !data) return;
    const sid = typeof data.space_id === "string" ? data.space_id.trim() : "";
    initialSpaceIdRef.current = sid;
    setMoveSpace(sid);
  }, [isNew, data]);

  useEffect(() => {
    if (data?.markdown_doc) {
      try {
        setForm(parseProtocolMarkdownToForm(data.markdown_doc));
        setUploadKey(String(Date.now()));
      } catch {
        setForm({
          protocolLabel: data.label || "Protocol",
          triggersMarkdown: "",
          steps: [{ ...DEFAULT_STEP }],
          completionMarkdown: "",
        });
      }
    }
  }, [data]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      try {
        setForm(parseProtocolMarkdownToForm(text));
        setUploadKey(String(Date.now()));
        setValidationError(null);
        setError(null);
      } catch {
        setError("Could not parse the uploaded file. Use valid protocol markdown.");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const setFormField = <K extends keyof ProtocolFormState>(key: K, value: ProtocolFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setStep = (index: number, update: Partial<StepFormState> | ((s: StepFormState) => StepFormState)) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? (typeof update === "function" ? update(s) : { ...s, ...update }) : s)),
    }));
  };

  const addStep = () => {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, { ...DEFAULT_STEP, label: `Step ${prev.steps.length + 1}` }] }));
  };

  const removeStep = (index: number) => {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);
    const markdown = buildMarkdownFromForm(form);
    const parsed = markdownSchema.safeParse(markdown);
    if (!parsed.success) {
      setValidationError(parsed.error.errors[0]?.message ?? "Invalid");
      return;
    }
    const fork = forkSourceUri.trim();
    if (fork && !SOURCE_ADAPTER_URI_RE.test(fork)) {
      setValidationError(t("protocolEdit.forkUriInvalid"));
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const spaceParam = targetSpace.trim() || "personal";
        const res = await apiFetch("/api/train", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown_doc: markdown,
            llm_model_id: "kairos-ui",
            force_update: false,
            space: spaceParam,
            ...(fork ? { source_adapter_uri: fork } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? res.statusText);
        }
        const json = (await res.json()) as {
          items?: { uri?: string; adapter_uri?: string }[];
        };
        const adapterUri = json.items?.[0]?.adapter_uri;
        const layerUri = json.items?.[0]?.uri;
        if (adapterUri) navigate(`/protocols/${encodeURIComponent(adapterUri)}`);
        else if (layerUri) navigate(`/protocols/${encodeURIComponent(layerUri)}`);
        else navigate("/");
      } else {
        const initial = initialSpaceIdRef.current.trim();
        const nextSpace = moveSpace.trim();
        const tunePayload: Record<string, unknown> = {
          uris: [decodedUri!],
          markdown_doc: [markdown],
        };
        if (nextSpace && nextSpace !== initial) {
          tunePayload.space = nextSpace;
        }
        const res = await apiFetch("/api/tune", {
          method: "POST",
          body: JSON.stringify(tunePayload),
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

  const preview = (() => {
    try {
      return parseProtocolMarkdown(buildMarkdownFromForm(form));
    } catch {
      return { title: form.protocolLabel || "Protocol", steps: [], triggers: "", completion: "" };
    }
  })();

  if (!isNew && loadingExisting && !data) {
    return <p className="text-[var(--color-text-muted)]">{t("protocol.loading")}</p>;
  }

  const challengeTypeLabel: Record<StepFormState["type"], string> = {
    shell: t("protocolEdit.challengeShell"),
    mcp: t("protocolEdit.challengeMcp"),
    user_input: t("protocolEdit.challengeUserInput"),
    comment: t("protocolEdit.challengeComment"),
  };

  const skillFolderSlug =
    (form.protocolLabel.trim() || preview.title || "skill")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "skill";

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-heading)]">
        {isNew ? t("protocolEdit.newTitle") : t("protocolEdit.editTitle")}
      </h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">{t("protocolEdit.hint")}</p>

      <section className="mb-8 space-y-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5">
        {isNew ? (
          <>
            <div>
              <label
                htmlFor="protocol-target-space"
                className="mb-2 block font-medium text-[var(--color-text-heading)]"
              >
                {t("protocolEdit.targetSpaceLabel")}
              </label>
              <SpaceSelect
                id="protocol-target-space"
                spaces={spacesData?.spaces}
                value={targetSpace}
                onChange={setTargetSpace}
                disabled={spacesLoading}
              />
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("protocolEdit.targetSpaceHint")}</p>
            </div>
            <div>
              <label
                htmlFor="protocol-fork-source"
                className="mb-2 block font-medium text-[var(--color-text-heading)]"
              >
                {t("protocolEdit.forkSourceLabel")}
              </label>
              <input
                id="protocol-fork-source"
                type="text"
                value={forkSourceUri}
                onChange={(e) => setForkSourceUri(e.target.value)}
                placeholder={t("protocolEdit.forkSourcePlaceholder")}
                autoComplete="off"
                className="min-h-[44px] w-full max-w-2xl rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
              />
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("protocolEdit.forkSourceHint")}</p>
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="protocol-move-space"
              className="mb-2 block font-medium text-[var(--color-text-heading)]"
            >
              {t("protocolEdit.moveSpaceLabel")}
            </label>
            <SpaceSelect
              id="protocol-move-space"
              spaces={spacesData?.spaces}
              value={moveSpace}
              onChange={setMoveSpace}
              disabled={spacesLoading}
            />
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("protocolEdit.moveSpaceHint")}</p>
          </div>
        )}
      </section>

      <SurfaceCard
        className="mb-8"
        title={t("protocolEdit.importCardTitle")}
        subtitle={t("protocolEdit.uploadHint")}
      >
        <div className="flex flex-wrap gap-2">
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
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {t("protocolEdit.upload")}
          </button>
          {!isNew && decodedUri && (
            <Link
              to={`/protocols/${encodeURIComponent(decodedUri)}/skill`}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
            >
              {t("protocol.editAsSkill")}
            </Link>
          )}
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit} aria-label={t("protocolEdit.formLabel")}>
        <div className="mb-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="space-y-6">
            <div>
              <label htmlFor="protocol-label" className="mb-2 block font-medium text-[var(--color-text-heading)]">
                {t("protocolEdit.protocolLabel")}
              </label>
              <input
                id="protocol-label"
                type="text"
                value={form.protocolLabel}
                onChange={(e) => setFormField("protocolLabel", e.target.value)}
                className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
              />
            </div>

            <RichTextEditor
              label={t("protocolEdit.triggersLabel")}
              hint={t("protocolEdit.triggersEditorHint")}
              value={form.triggersMarkdown}
              onChange={(v) => setFormField("triggersMarkdown", v)}
              contentKey={uploadKey}
            />

            {form.steps.map((step, index) => (
              <div
                key={index}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 space-y-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text-heading)]">
                      {t("protocolEdit.stepHeading", { n: index + 1 })}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">{t("protocolEdit.stepEditorHint")}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    disabled={form.steps.length <= 1}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2 disabled:opacity-50"
                  >
                    {t("protocolEdit.removeStep")}
                  </button>
                </div>
                <div>
                  <label className="mb-2 block font-medium text-[var(--color-text-heading)]">{t("protocolEdit.stepLabel")}</label>
                  <input
                    type="text"
                    value={step.label}
                    onChange={(e) => setStep(index, { label: e.target.value })}
                    className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]                     focus-visible:outline-offset-2"
                  />
                </div>
                <div>
                  <div className="mb-2 font-medium text-[var(--color-text-heading)]">{t("protocolEdit.challengeType")}</div>
                  <div className="flex flex-wrap gap-2">
                    {CHALLENGE_TYPE_KEYS.map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={step.type === type}
                        onClick={() =>
                          setStep(index, {
                            type,
                            shell:
                              type === "shell"
                                ? {
                                    cmd: step.shell?.cmd ?? "",
                                    timeout_seconds: step.shell?.timeout_seconds ?? 30,
                                    interpreter: step.shell?.interpreter,
                                    workdir: step.shell?.workdir,
                                    flags: step.shell?.flags ?? [],
                                    args: step.shell?.args ?? [],
                                  }
                                : undefined,
                            mcp: type === "mcp" ? { tool_name: step.mcp?.tool_name ?? "" } : undefined,
                            user_input: type === "user_input" ? { prompt: step.user_input?.prompt ?? "" } : undefined,
                            comment: type === "comment" ? { min_length: step.comment?.min_length ?? 10 } : undefined,
                          })
                        }
                        className={`min-h-[44px] rounded-[var(--radius-md)] px-4 text-sm font-medium ${
                          step.type === type
                            ? "bg-[var(--color-primary)] text-white"
                            : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                        }`}
                      >
                        {challengeTypeLabel[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <RichTextEditor
                    label={t("protocolEdit.stepContent")}
                    value={step.bodyMarkdown}
                    onChange={(v) => setStep(index, { bodyMarkdown: v })}
                    contentKey={uploadKey}
                  />
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="mb-3 text-sm font-medium text-[var(--color-text-heading)]">Challenge fields</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {step.type === "shell" && (
                      <>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                            {t("protocolEdit.shellCmd")}
                          </label>
                          <input
                            type="text"
                            value={step.shell?.cmd ?? ""}
                            onChange={(e) =>
                              setStep(index, {
                                shell: {
                                  cmd: e.target.value,
                                  timeout_seconds: step.shell?.timeout_seconds ?? 30,
                                  interpreter: step.shell?.interpreter,
                                  workdir: step.shell?.workdir,
                                  flags: step.shell?.flags ?? [],
                                  args: step.shell?.args ?? [],
                                },
                              })
                            }
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                            {t("protocolEdit.shellTimeout")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={step.shell?.timeout_seconds ?? 30}
                            onChange={(e) =>
                              setStep(index, {
                                shell: {
                                  cmd: step.shell?.cmd ?? "",
                                  timeout_seconds: Math.max(1, Number(e.target.value) || 30),
                                  interpreter: step.shell?.interpreter,
                                  workdir: step.shell?.workdir,
                                  flags: step.shell?.flags ?? [],
                                  args: step.shell?.args ?? [],
                                },
                              })
                            }
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                            {t("protocolEdit.shellInterpreter")}
                          </label>
                          <input
                            type="text"
                            value={step.shell?.interpreter ?? ""}
                            onChange={(e) =>
                              setStep(index, {
                                shell: {
                                  cmd: step.shell?.cmd ?? "",
                                  timeout_seconds: step.shell?.timeout_seconds ?? 30,
                                  interpreter: e.target.value || undefined,
                                  workdir: step.shell?.workdir,
                                  flags: step.shell?.flags ?? [],
                                  args: step.shell?.args ?? [],
                                },
                              })
                            }
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                            {t("protocolEdit.shellWorkdir")}
                          </label>
                          <input
                            type="text"
                            value={step.shell?.workdir ?? ""}
                            onChange={(e) =>
                              setStep(index, {
                                shell: {
                                  cmd: step.shell?.cmd ?? "",
                                  timeout_seconds: step.shell?.timeout_seconds ?? 30,
                                  interpreter: step.shell?.interpreter,
                                  workdir: e.target.value || undefined,
                                  flags: step.shell?.flags ?? [],
                                  args: step.shell?.args ?? [],
                                },
                              })
                            }
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                            {t("protocolEdit.shellFlags")}
                          </label>
                          <textarea
                            rows={3}
                            value={(step.shell?.flags ?? []).join("\n")}
                            onChange={(e) =>
                              setStep(index, {
                                shell: {
                                  cmd: step.shell?.cmd ?? "",
                                  timeout_seconds: step.shell?.timeout_seconds ?? 30,
                                  interpreter: step.shell?.interpreter,
                                  workdir: step.shell?.workdir,
                                  flags: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                                  args: step.shell?.args ?? [],
                                },
                              })
                            }
                            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                            {t("protocolEdit.shellArgs")}
                          </label>
                          <textarea
                            rows={3}
                            value={(step.shell?.args ?? []).join("\n")}
                            onChange={(e) =>
                              setStep(index, {
                                shell: {
                                  cmd: step.shell?.cmd ?? "",
                                  timeout_seconds: step.shell?.timeout_seconds ?? 30,
                                  interpreter: step.shell?.interpreter,
                                  workdir: step.shell?.workdir,
                                  flags: step.shell?.flags ?? [],
                                  args: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                                },
                              })
                            }
                            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                          />
                        </div>
                      </>
                    )}
                    {step.type === "mcp" && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                          {t("protocolEdit.mcpToolName")}
                        </label>
                        <input
                          type="text"
                          value={step.mcp?.tool_name ?? ""}
                          onChange={(e) => setStep(index, { mcp: { tool_name: e.target.value } })}
                          className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                        />
                      </div>
                    )}
                    {step.type === "user_input" && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                          {t("protocolEdit.userInputPrompt")}
                        </label>
                        <input
                          type="text"
                          value={step.user_input?.prompt ?? ""}
                          onChange={(e) => setStep(index, { user_input: { prompt: e.target.value } })}
                          className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                        />
                      </div>
                    )}
                    {step.type === "comment" && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--color-text-heading)]">
                          {t("protocolEdit.commentMinLength")}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={step.comment?.min_length ?? 10}
                          onChange={(e) => setStep(index, { comment: { min_length: Math.max(1, parseInt(e.target.value, 10) || 10) } })}
                          className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addStep}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
            >
              {t("protocolEdit.addStep")}
            </button>

            <RichTextEditor
              label={t("protocolEdit.completionLabel")}
              value={form.completionMarkdown}
              onChange={(v) => setFormField("completionMarkdown", v)}
              contentKey={uploadKey}
            />

            {validationError && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {validationError}
              </p>
            )}
            {error && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-error-bg)] p-4 text-[var(--color-error)]" role="alert">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2 disabled:opacity-60"
              >
                {saving ? t("protocolEdit.saving") : t("protocolEdit.save")}
              </button>
              <Link
                to={isNew ? "/" : `/protocols/${encodeURIComponent(decodedUri!)}`}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 font-medium text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
              >
                {t("protocolEdit.cancel")}
              </Link>
            </div>
          </div>

          <div className="space-y-4" aria-label={t("protocolEdit.previewLabel")}>
            <SurfaceCard title={t("protocolEdit.previewRenderedTitle")} subtitle={t("protocolEdit.previewRenderedSubtitle")}>
              <div className="text-lg font-semibold text-[var(--color-text-heading)]">{preview.title}</div>
              <div className="mt-3 space-y-3">
                {preview.steps.length === 0 ? (
                  <div className="text-sm text-[var(--color-text-muted)]">{t("protocolEdit.previewNoSteps")}</div>
                ) : (
                  preview.steps.slice(0, 20).map((s, idx) => (
                    <div
                      key={`${s.label}:${idx}`}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                    >
                      <div className="font-medium text-[var(--color-text-heading)]">
                        {t("protocolEdit.previewStepLine", { n: idx + 1, label: s.label })}
                      </div>
                      <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {CHALLENGE_TYPE_LABEL[s.type] ?? s.type}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">
                <div>
                  <strong className="text-[var(--color-text-heading)]">{t("protocol.triggers")}:</strong>{" "}
                  {preview.triggers ? t("protocolEdit.present") : t("protocolEdit.missing")}
                </div>
                <div className="mt-1">
                  <strong className="text-[var(--color-text-heading)]">{t("protocol.completion")}:</strong>{" "}
                  {preview.completion ? t("protocolEdit.present") : t("protocolEdit.missing")}
                </div>
              </div>
            </SurfaceCard>

            {!isNew && decodedUri ? (
              <SurfaceCard title={t("protocolEdit.skillShortcutTitle")} subtitle={t("protocolEdit.skillShortcutSubtitle")}>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="font-medium text-[var(--color-text-heading)]">{skillFolderSlug}-skill/</div>
                  <div className="mt-2 font-mono text-sm text-[var(--color-text-muted)]">
                    Skill.md
                    <br />
                    references/
                    <br />
                    &nbsp;&nbsp;KAIROS.md
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/protocols/${encodeURIComponent(decodedUri)}/skill`}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                  >
                    {t("protocol.editAsSkill")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const md = `# ${preview.title}\n\n${buildMarkdownFromForm(form)}`;
                      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${skillFolderSlug}-skill.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                  >
                    {t("protocol.downloadAsSkill")}
                  </button>
                </div>
              </SurfaceCard>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
