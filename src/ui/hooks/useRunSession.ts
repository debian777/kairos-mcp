import { useCallback, useEffect, useMemo, useState } from "react";
import type { Challenge, KairosStep, ProofOfWorkSubmission } from "@/lib/kairosRunTypes";

export type RunHistoryItem = {
  step: KairosStep;
  challenge: Challenge;
  solution: ProofOfWorkSubmission;
  submitted_at: string;
  /** proof_hash returned by server after submission (used as previous proof for next step) */
  proof_hash?: string;
  server_message?: string;
};

export type RunSession = {
  id: string;
  protocol_uri: string;
  started_at: string;
  updated_at: string;
  status: "running" | "ready_to_attest" | "completed" | "error";
  current_step: KairosStep;
  challenge: Challenge;
  next_action?: string;
  last_message?: string;
  previous_proof_hash?: string;
  attest_uri?: string;
  history: RunHistoryItem[];
};

const STORAGE_KEY = "kairos.runSessions.v1";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function loadAll(): RunSession[] {
  const parsed = safeJsonParse<RunSession[]>(typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null);
  return Array.isArray(parsed) ? parsed : [];
}

function saveAll(all: RunSession[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function useRunSessions() {
  const [sessions, setSessions] = useState<RunSession[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessions(loadAll());
  }, []);

  const refresh = useCallback(() => {
    setSessions(loadAll());
  }, []);

  const upsert = useCallback((session: RunSession) => {
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === session.id);
    const next = idx >= 0 ? [...all.slice(0, idx), session, ...all.slice(idx + 1)] : [session, ...all];
    saveAll(next);
    setSessions(next);
  }, []);

  const remove = useCallback((id: string) => {
    const all = loadAll();
    const next = all.filter((s) => s.id !== id);
    saveAll(next);
    setSessions(next);
  }, []);

  return { sessions, refresh, upsert, remove };
}

export function useRunSession(sessionId: string | null) {
  const { sessions, upsert } = useRunSessions();
  const session = useMemo(() => sessions.find((s) => s.id === sessionId) ?? null, [sessions, sessionId]);
  const update = useCallback(
    (next: RunSession) => {
      upsert(next);
    },
    [upsert]
  );
  return { session, update };
}

