import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ForwardOutput, ForwardSolution } from "../../tools/forward_schema.js";
import type { NextOutput } from "@/lib/kairosRunTypes";

export type KairosNextInput = {
  uri: string;
  solution: ForwardSolution;
};

function normalizeForward(output: ForwardOutput): NextOutput {
  return {
    ...output,
    current_step: output.current_layer,
    challenge: output.contract,
  } as NextOutput;
}

async function kairosNext(input: KairosNextInput): Promise<NextOutput> {
  const res = await apiFetch("/api/forward", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  const output = (await res.json()) as ForwardOutput;
  return normalizeForward(output);
}

export function useKairosNext() {
  return useMutation({
    mutationFn: (input: KairosNextInput) => kairosNext(input),
  });
}

