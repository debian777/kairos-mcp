import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ForwardOutput } from "../../tools/forward_schema.js";
import type { BeginOutput } from "@/lib/kairosRunTypes";

function normalizeForward(output: ForwardOutput): BeginOutput {
  return {
    ...output,
    current_step: output.current_layer,
    challenge: output.contract,
  } as BeginOutput;
}

async function kairosBegin(uri: string): Promise<BeginOutput> {
  const res = await apiFetch("/api/forward", {
    method: "POST",
    body: JSON.stringify({ uri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  const output = (await res.json()) as ForwardOutput;
  return normalizeForward(output);
}

export function useKairosBegin() {
  return useMutation({
    mutationFn: (uri: string) => kairosBegin(uri),
  });
}

