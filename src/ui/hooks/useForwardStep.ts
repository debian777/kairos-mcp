import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ForwardOutput, ForwardSolution } from "../../tools/forward_schema.js";

export type ForwardStepInput = {
  uri: string;
  solution: ForwardSolution;
};

async function forwardStep(input: ForwardStepInput): Promise<ForwardOutput> {
  const res = await apiFetch("/api/forward", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return (await res.json()) as ForwardOutput;
}

export function useForwardStep() {
  return useMutation({
    mutationFn: (input: ForwardStepInput) => forwardStep(input),
  });
}
