import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { RunGuidedContent } from "@/components/run/RunGuidedContent";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useKairosBegin } from "@/hooks/useKairosBegin";
import { useKairosNext } from "@/hooks/useKairosNext";
import { useKairosAttest } from "@/hooks/useKairosAttest";
import { useRunSession, useRunSessions, type RunSession } from "@/hooks/useRunSession";
import type { ProofOfWorkSubmission } from "@/lib/kairosRunTypes";

function extractFirstMemUri(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = text.match(/kairos:\/\/mem\/[0-9a-fA-F-]{36}/);
  return m?.[0];
}

function nowIso() {
  return new Date().toISOString();
}

export function RunGuidedPage() {
  const { t } = useTranslation();
  const { uri } = useParams<{ uri: string }>();
  const [searchParams] = useSearchParams();
  const decodedUri = uri ? decodeURIComponent(uri) : undefined;

  const sessionIdFromQuery = searchParams.get("session");
  const { session: existingSession } = useRunSession(sessionIdFromQuery);
  const { upsert } = useRunSessions();

  const begin = useKairosBegin();
  const next = useKairosNext();
  const attest = useKairosAttest();

  const [run, setRun] = useState<RunSession | null>(null);
  const [attestOutcome, setAttestOutcome] = useState<"success" | "failure">("success");
  const [attestMessage, setAttestMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (existingSession && !run) {
      setRun(existingSession);
      setAttestOutcome("success");
      setAttestMessage("");
    }
  }, [existingSession, run]);

  const persist = (session: RunSession) => {
    setRun(session);
    upsert(session);
  };

  const handleStart = async () => {
    if (!decodedUri) return;
    try {
      const res = await begin.mutateAsync(decodedUri);
      const startedAt = nowIso();
      const id = `${decodedUri}:${startedAt}`;
      const status: RunSession["status"] = res.next_action?.includes("kairos_attest") ? "ready_to_attest" : "running";
      const attestUri = extractFirstMemUri(res.next_action);
      persist({
        id,
        protocol_uri: decodedUri,
        started_at: startedAt,
        updated_at: startedAt,
        status,
        current_step: res.current_step,
        challenge: res.challenge,
        next_action: res.next_action,
        last_message: res.message,
        previous_proof_hash: res.proof_hash,
        attest_uri: status === "ready_to_attest" ? attestUri : undefined,
        history: [],
      });
    } catch (_err) {
      setRun(null);
    }
  };

  const handleCopy = async (text: string) => {
    setCopyStatus(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(t("run.copied"));
      setTimeout(() => setCopyStatus(null), 1500);
    } catch (err) {
      setCopyStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSubmitStep = async (draft: Omit<ProofOfWorkSubmission, "nonce" | "proof_hash" | "previousProofHash">) => {
    if (!run) return;
    const nonce = run.challenge.nonce;
    const proofHash = run.previous_proof_hash ?? run.challenge.proof_hash;
    const solution: ProofOfWorkSubmission = {
      ...draft,
      ...(nonce ? { nonce } : {}),
      ...(proofHash ? { proof_hash: proofHash } : {}),
    };

    try {
      const res = await next.mutateAsync({ uri: run.current_step.uri, solution });
      const updatedAt = nowIso();
      const readyToAttest = res.next_action?.includes("kairos_attest") || (res.message?.toLowerCase().includes("call kairos_attest") ?? false);
      const attestUri = extractFirstMemUri(res.next_action) ?? run.attest_uri;
      persist({
        ...run,
        updated_at: updatedAt,
        status: readyToAttest ? "ready_to_attest" : "running",
        current_step: res.current_step,
        challenge: res.challenge,
        next_action: res.next_action,
        last_message: res.message,
        previous_proof_hash: res.proof_hash ?? run.previous_proof_hash,
        attest_uri: readyToAttest ? attestUri : undefined,
        history: [
          ...run.history,
          {
            step: run.current_step,
            challenge: run.challenge,
            solution,
            submitted_at: updatedAt,
            proof_hash: res.proof_hash,
            server_message: res.message,
          },
        ],
      });
    } catch (err) {
      persist({
        ...run,
        updated_at: nowIso(),
        status: "error",
        last_message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleAttest = async () => {
    if (!run) return;
    const attestUri = run.attest_uri ?? run.current_step.uri;
    try {
      const res = await attest.mutateAsync({
        uri: attestUri,
        outcome: attestOutcome,
        message: attestMessage.trim() || t("run.attest.defaultMessage"),
      });
      persist({
        ...run,
        updated_at: nowIso(),
        status: "completed",
        last_message: res.results[0]?.message ?? run.last_message,
      });
    } catch (err) {
      persist({
        ...run,
        updated_at: nowIso(),
        status: "error",
        last_message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (!decodedUri) {
    return <ErrorAlert message={t("run.missingUri")} showGoBack={true} />;
  }

  return (
    <div>
      <h1 className="text-[var(--color-text-heading)] text-2xl font-semibold mb-1">{t("run.title")}</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        {t("run.protocolUri")}:{" "}
        <span className="font-mono break-all">{decodedUri}</span>
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          to={`/protocols/${encodeURIComponent(decodedUri)}`}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-md)] font-medium border border-[var(--color-border)] text-[var(--color-text)] no-underline hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
        >
          {t("run.backToProtocol")}
        </Link>
        {!run && (
          <button
            type="button"
            onClick={handleStart}
            disabled={begin.isPending}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-[var(--radius-md)] font-medium bg-[var(--color-primary)] text-white border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-2"
          >
            {begin.isPending ? t("run.starting") : t("run.start")}
          </button>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 mb-6">
        <strong className="block text-[var(--color-text-heading)] mb-1">{t("run.safety.title")}</strong>
        <p className="text-sm text-[var(--color-text-muted)]">{t("run.safety.copy")}</p>
      </div>

      {begin.isError && (
        <ErrorAlert
          message={begin.error instanceof Error ? begin.error.message : String(begin.error)}
          onRetry={() => handleStart()}
          showGoBack={true}
        />
      )}

      {run?.status === "error" && run.last_message && (
        <div className="mb-6">
          <ErrorAlert
            message={run.last_message}
            onRetry={() => handleStart()}
            showGoBack={true}
          />
        </div>
      )}

      {run && run.status !== "error" && (
        <RunGuidedContent
          run={run}
          attestOutcome={attestOutcome}
          setAttestOutcome={setAttestOutcome}
          attestMessage={attestMessage}
          setAttestMessage={setAttestMessage}
          copyStatus={copyStatus}
          onCopy={handleCopy}
          onSubmitStep={handleSubmitStep}
          onAttest={handleAttest}
          isNextPending={next.isPending}
          isBeginPending={begin.isPending}
          isAttestPending={attest.isPending}
        />
      )}
    </div>
  );
}

