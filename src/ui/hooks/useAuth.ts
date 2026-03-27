import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { MeResponse } from "../../me-response.js";

export type { MeResponse };

async function fetchMe(): Promise<MeResponse> {
  const res = await apiFetch("/api/me");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error((err as { message?: string }).message ?? res.statusText) as Error & { statusCode?: number };
    e.statusCode = res.status;
    throw e;
  }
  return res.json();
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
  });
}
