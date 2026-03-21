import { useTranslation } from "react-i18next";
import { RenderedMarkdown } from "@/components/RenderedMarkdown";
import { SolutionForm } from "@/components/run/SolutionForm";
import type { RunSession } from "@/hooks/useRunSession";
import type { ProofOfWorkSubmission } from "@/lib/kairosRunTypes";

export interface RunGuidedContentProps {
  run: RunSession;
  attestOutcome: "success" | "failure";
  setAttestOutcome: (v: "success" | "failure") => void;
  attestMessage: string;
  setAttestMessage: (v: string) => void;
  copyStatus: string | null;
  onCopy: (text: string) => void;
  onSubmitStep: (draft: Omit<ProofOfWorkSubmission, "nonce" | "proof_hash" | "previousProofHash">) => void;
  onAttest: () => void;
  isNextPending: boolean;
  isBeginPending: boolean;
  isAttestPending: boolean;
}

export function RunGuidedContent({
  run,
  attestOutcome,
  setAttestOutcome,
  attestMessage,
  setAttestMessage,
  copyStatus,
  onCopy,
  onSubmitStep,
  onAttest,
  isNextPending,
  isBeginPending,
  isAttestPending,
}: RunGuidedContentProps) {
  const { t } = useTranslation();

  return (
    <>
      {run.status === "running" && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]" role="status" aria-live="polite">
          <span className="font-medium text-[var(--color-text-heading)]">
            {t("run.stepperProgress", { completed: run.history.length })}
          </span>
        </div>
      )}
      {run.last_message && (
        <div
          className="mb-4 p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          role="status"
          aria-live="polite"
        >
          <div className="text-sm text-[var(--color-text-muted)]">{t("run.serverMessage")}</div>
          <div className="text-[var(--color-text)]">{run.last_message}</div>
        </div>
      )}

      <section aria-labelledby="run-current-step" className="mb-6">
        <h2 id="run-current-step" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          {t("run.currentStep")}
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          {run.current_step ? (
            <>
              <div className="text-sm text-[var(--color-text-muted)] mb-2">
                {t("run.stepUri")}: <span className="font-mono break-all">{run.current_step.uri}</span>
              </div>
              {run.current_step.content ? (
                <RenderedMarkdown content={run.current_step.content} />
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] m-0">{t("run.noStepContent")}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] m-0">{t("run.noStepContent")}</p>
          )}
        </div>
      </section>

      <section aria-labelledby="run-challenge" className="mb-6">
        <h2 id="run-challenge" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          {t("run.challenge")}
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-[var(--color-text-muted)]">{t("run.challengeType")}</div>
              <div className="font-medium text-[var(--color-text-heading)]">{run.challenge.type}</div>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--color-primary)]">{t("run.advanced")}</summary>
              <div className="mt-2 space-y-1 text-[var(--color-text-muted)]">
                {run.challenge.nonce && (
                  <div>
                    {t("run.nonce")}: <span className="font-mono break-all">{run.challenge.nonce}</span>
                  </div>
                )}
                {run.challenge.proof_hash && (
                  <div>
                    {t("run.proofHash")}: <span className="font-mono break-all">{run.challenge.proof_hash}</span>
                  </div>
                )}
                {run.previous_proof_hash && (
                  <div>
                    {t("run.previousProofHash")}: <span className="font-mono break-all">{run.previous_proof_hash}</span>
                  </div>
                )}
              </div>
            </details>
          </div>

          {run.challenge.description && (
            <p className="text-sm text-[var(--color-text-muted)] mt-3">{run.challenge.description}</p>
          )}

          {run.challenge.type === "tensor" && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="text-sm text-[var(--color-text-muted)]">Tensor output</div>
              <div className="font-medium text-[var(--color-text-heading)]">
                {run.challenge.tensor?.output.name ?? "tensor"} ({run.challenge.tensor?.output.type ?? "unknown"})
              </div>
              {run.challenge.tensor?.required_inputs?.length ? (
                <div className="text-sm text-[var(--color-text-muted)] mt-2">
                  Required inputs: {run.challenge.tensor.required_inputs.join(", ")}
                </div>
              ) : null}
            </div>
          )}

          {run.challenge.type === "shell" && run.challenge.shell?.cmd && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-[var(--color-text-muted)]">{t("run.shell.command")}</div>
                  <div className="font-mono text-sm text-[var(--color-text)] break-all">{run.challenge.shell.cmd}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(run.challenge.shell!.cmd!)}
                  className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] bg-transparent flex-shrink-0 hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("run.copy")}
                </button>
              </div>
              {copyStatus && <div className="text-xs text-[var(--color-text-muted)] mt-2">{copyStatus}</div>}
            </div>
          )}
        </div>
      </section>

      {run.status !== "completed" && run.status !== "ready_to_attest" && (
        <section aria-labelledby="run-solution" className="mb-6">
          <h2 id="run-solution" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("run.solution")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <SolutionForm
              challenge={run.challenge}
              disabled={isNextPending || isBeginPending}
              onSubmit={onSubmitStep}
            />
          </div>
        </section>
      )}

      {run.status === "ready_to_attest" && (
        <section aria-labelledby="run-attest" className="mb-6">
          <h2 id="run-attest" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("run.attest.title")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <div className="text-sm text-[var(--color-text-muted)] mb-4">{t("run.attest.subtitle")}</div>
            <div className="flex flex-wrap gap-4 mb-4" role="radiogroup" aria-label={t("run.attest.outcomeLabel")}>
              <label className="inline-flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="attest-outcome"
                  value="success"
                  checked={attestOutcome === "success"}
                  onChange={() => setAttestOutcome("success")}
                />
                <span className="text-sm text-[var(--color-text)]">{t("run.attest.success")}</span>
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="attest-outcome"
                  value="failure"
                  checked={attestOutcome === "failure"}
                  onChange={() => setAttestOutcome("failure")}
                />
                <span className="text-sm text-[var(--color-text)]">{t("run.attest.failure")}</span>
              </label>
            </div>
            <div className="mb-4">
              <label htmlFor="run-attest-message" className="block font-medium text-[var(--color-text-heading)] mb-2">
                {t("run.attest.message")}
              </label>
              <textarea
                id="run-attest-message"
                value={attestMessage}
                onChange={(e) => setAttestMessage(e.target.value)}
                className="w-full min-h-[8rem] px-4 py-3 border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] bg-[var(--color-surface)] resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
              />
            </div>
            <button
              type="button"
              onClick={onAttest}
              disabled={isAttestPending}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
            >
              {isAttestPending ? t("run.attest.submitting") : t("run.attest.submit")}
            </button>
          </div>
        </section>
      )}

      {run.history.length > 0 && (
        <section aria-labelledby="run-history" className="mb-6">
          <h2 id="run-history" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("run.history")}
          </h2>
          <ul className="list-none p-0 m-0 space-y-2" aria-label={t("run.historyLabel")}>
            {run.history
              .slice()
              .reverse()
              .map((h, idx) => (
                <li
                  key={`${h.step.uri}:${idx}`}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4"
                >
                  <div className="text-sm text-[var(--color-text-muted)]">
                    {new Date(h.submitted_at).toLocaleString()} · {h.challenge.type} ·{" "}
                    <span className="font-mono break-all">{h.step.uri}</span>
                  </div>
                  {h.server_message && <div className="text-sm text-[var(--color-text)] mt-1">{h.server_message}</div>}
                </li>
              ))}
          </ul>
        </section>
      )}

      {run.status === "completed" && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[#dcfce7] text-[#166534] p-4">
          <strong className="block">{t("run.completed")}</strong>
          {run.last_message && <div className="text-sm mt-1">{run.last_message}</div>}
        </div>
      )}
    </>
  );
}
