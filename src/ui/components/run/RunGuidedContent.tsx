import { useTranslation } from "react-i18next";
import { RenderedMarkdown } from "@/components/RenderedMarkdown";
import { SolutionForm } from "@/components/run/SolutionForm";
import type { RunSession } from "@/hooks/useRunSession";
import type { RunSolutionSubmission } from "@/lib/runToolTypes";

export interface RunGuidedContentProps {
  run: RunSession;
  rewardOutcome: "success" | "failure";
  setRewardOutcome: (v: "success" | "failure") => void;
  rewardFeedback: string;
  setRewardFeedback: (v: string) => void;
  copyStatus: string | null;
  onCopy: (text: string) => void;
  onSubmitStep: (draft: Omit<RunSolutionSubmission, "nonce" | "proof_hash" | "previousProofHash">) => void;
  onReward: () => void;
  isForwardStepPending: boolean;
  isForwardStartPending: boolean;
  isRewardPending: boolean;
}

export function RunGuidedContent({
  run,
  rewardOutcome,
  setRewardOutcome,
  rewardFeedback,
  setRewardFeedback,
  copyStatus,
  onCopy,
  onSubmitStep,
  onReward,
  isForwardStepPending,
  isForwardStartPending,
  isRewardPending,
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
          {t("run.currentLayer")}
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          {run.current_layer ? (
            <>
              <div className="text-sm text-[var(--color-text-muted)] mb-2">
                {t("run.layerUri")}: <span className="font-mono break-all">{run.current_layer.uri}</span>
              </div>
              {run.current_layer.content ? (
                <RenderedMarkdown content={run.current_layer.content} />
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] m-0">{t("run.noLayerContent")}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] m-0">{t("run.noLayerContent")}</p>
          )}
        </div>
      </section>

      <section aria-labelledby="run-challenge" className="mb-6">
        <h2 id="run-challenge" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
          {t("run.contract")}
        </h2>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-[var(--color-text-muted)]">{t("run.contractType")}</div>
              <div className="font-medium text-[var(--color-text-heading)]">{run.contract.type}</div>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--color-primary)]">{t("run.advanced")}</summary>
              <div className="mt-2 space-y-1 text-[var(--color-text-muted)]">
                {run.contract.nonce && (
                  <div>
                    {t("run.nonce")}: <span className="font-mono break-all">{run.contract.nonce}</span>
                  </div>
                )}
                {run.contract.proof_hash && (
                  <div>
                    {t("run.proofHash")}: <span className="font-mono break-all">{run.contract.proof_hash}</span>
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

          {run.contract.description && (
            <p className="text-sm text-[var(--color-text-muted)] mt-3">{run.contract.description}</p>
          )}

          {run.contract.type === "tensor" && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="text-sm text-[var(--color-text-muted)]">Tensor output</div>
              <div className="font-medium text-[var(--color-text-heading)]">
                {run.contract.tensor?.output.name ?? "tensor"} ({run.contract.tensor?.output.type ?? "unknown"})
              </div>
              {run.contract.tensor?.required_inputs?.length ? (
                <div className="text-sm text-[var(--color-text-muted)] mt-2">
                  Required inputs: {run.contract.tensor.required_inputs.join(", ")}
                </div>
              ) : null}
            </div>
          )}

          {run.contract.type === "shell" && run.contract.shell?.cmd && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-[var(--color-text-muted)]">{t("run.shell.command")}</div>
                  <div className="font-mono text-sm text-[var(--color-text)] break-all">{run.contract.shell.cmd}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(run.contract.shell!.cmd!)}
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

      {run.status !== "completed" && run.status !== "ready_to_reward" && (
        <section aria-labelledby="run-solution" className="mb-6">
          <h2 id="run-solution" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("run.solution")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <SolutionForm
              contract={run.contract}
              disabled={isForwardStepPending || isForwardStartPending}
              onSubmit={onSubmitStep}
            />
          </div>
        </section>
      )}

      {run.status === "ready_to_reward" && (
        <section aria-labelledby="run-reward" className="mb-6">
          <h2 id="run-reward" className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">
            {t("run.reward.title")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <div className="text-sm text-[var(--color-text-muted)] mb-4">{t("run.reward.subtitle")}</div>
            <div className="flex flex-wrap gap-4 mb-4" role="radiogroup" aria-label={t("run.reward.outcomeLabel")}>
              <label className="inline-flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="reward-outcome"
                  value="success"
                  checked={rewardOutcome === "success"}
                  onChange={() => setRewardOutcome("success")}
                />
                <span className="text-sm text-[var(--color-text)]">{t("run.reward.success")}</span>
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="reward-outcome"
                  value="failure"
                  checked={rewardOutcome === "failure"}
                  onChange={() => setRewardOutcome("failure")}
                />
                <span className="text-sm text-[var(--color-text)]">{t("run.reward.failure")}</span>
              </label>
            </div>
            <div className="mb-4">
              <label htmlFor="run-reward-feedback" className="block font-medium text-[var(--color-text-heading)] mb-2">
                {t("run.reward.feedback")}
              </label>
              <textarea
                id="run-reward-feedback"
                value={rewardFeedback}
                onChange={(e) => setRewardFeedback(e.target.value)}
                className="w-full min-h-[8rem] px-4 py-3 border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] bg-[var(--color-surface)] resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
              />
            </div>
            <button
              type="button"
              onClick={onReward}
              disabled={isRewardPending}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
            >
              {isRewardPending ? t("run.reward.submitting") : t("run.reward.submit")}
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
                  key={`${h.layer.uri}:${idx}`}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4"
                >
                  <div className="text-sm text-[var(--color-text-muted)]">
                    {new Date(h.submitted_at).toLocaleString()} · {h.contract.type} ·{" "}
                    <span className="font-mono break-all">{h.layer.uri}</span>
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
