import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { BeginOutput } from "../../tools/kairos_begin.js";

async function kairosBegin(uri: string): Promise<BeginOutput> {
  const res = await apiFetch("/api/kairos_begin", {
    method: "POST",
    body: JSON.stringify({ uri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json();
}

export function useKairosBegin() {
  return useMutation({
    mutationFn: (uri: string) => kairosBegin(uri),
  });
}

