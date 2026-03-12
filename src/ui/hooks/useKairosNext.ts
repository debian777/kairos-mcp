import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { KairosNextResponse, ProofOfWorkSubmission } from "@/lib/kairosRunTypes";

export type KairosNextInput = {
  uri: string;
  solution: ProofOfWorkSubmission;
};

async function kairosNext(input: KairosNextInput): Promise<KairosNextResponse> {
  const res = await apiFetch("/api/kairos_next", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json();
}

export function useKairosNext() {
  return useMutation({
    mutationFn: (input: KairosNextInput) => kairosNext(input),
  });
}

