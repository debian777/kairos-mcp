import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { NextOutput } from "../../tools/kairos_next.js";
import type { SolutionSubmission } from "../../tools/kairos_next_schema.js";

export type KairosNextInput = {
  uri: string;
  solution: SolutionSubmission;
};

async function kairosNext(input: KairosNextInput): Promise<NextOutput> {
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

