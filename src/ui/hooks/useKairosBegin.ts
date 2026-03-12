import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { KairosBeginResponse } from "@/lib/kairosRunTypes";

async function kairosBegin(uri: string): Promise<KairosBeginResponse> {
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

