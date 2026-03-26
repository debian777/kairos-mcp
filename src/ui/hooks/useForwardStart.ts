import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ForwardOutput } from "../../tools/forward_schema.js";

async function forwardStart(uri: string): Promise<ForwardOutput> {
  const res = await apiFetch("/api/forward", {
    method: "POST",
    body: JSON.stringify({ uri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return (await res.json()) as ForwardOutput;
}

export function useForwardStart() {
  return useMutation({
    mutationFn: (uri: string) => forwardStart(uri),
  });
}
