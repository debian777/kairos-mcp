import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AttestOutput } from "../../tools/kairos_attest_schema.js";

export type KairosAttestInput = {
  uri: string;
  outcome: "success" | "failure";
  message: string;
};

async function kairosAttest(input: KairosAttestInput): Promise<AttestOutput> {
  const res = await apiFetch("/api/kairos_attest", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json();
}

export function useKairosAttest() {
  return useMutation({
    mutationFn: (input: KairosAttestInput) => kairosAttest(input),
  });
}

