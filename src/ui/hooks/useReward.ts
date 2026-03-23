import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { RewardOutput } from "../../tools/reward_schema.js";

export type RewardInput = {
  uri: string;
  outcome: "success" | "failure";
  feedback: string;
};

async function reward(input: RewardInput): Promise<RewardOutput> {
  const res = await apiFetch("/api/reward", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return (await res.json()) as RewardOutput;
}

export function useReward() {
  return useMutation({
    mutationFn: (input: RewardInput) => reward(input),
  });
}
