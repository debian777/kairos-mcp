import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { RewardOutput } from "../../tools/reward_schema.js";
import type { AttestOutput } from "@/lib/kairosRunTypes";

export type KairosAttestInput = {
  uri: string;
  outcome: "success" | "failure";
  message: string;
};

async function kairosAttest(input: KairosAttestInput): Promise<AttestOutput> {
  const res = await apiFetch("/api/reward", {
    method: "POST",
    body: JSON.stringify({
      uri: input.uri,
      outcome: input.outcome,
      feedback: input.message,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  const output = (await res.json()) as RewardOutput;
  return {
    ...output,
    results: output.results.map((result) => ({
      ...result,
      message: result.feedback ?? "",
    })),
  } as AttestOutput;
}

export function useKairosAttest() {
  return useMutation({
    mutationFn: (input: KairosAttestInput) => kairosAttest(input),
  });
}

