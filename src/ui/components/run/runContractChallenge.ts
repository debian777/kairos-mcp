import type { ChallengePayload } from "@/components/ChallengeCard";
import type { RunContract } from "@/lib/runToolTypes";

/** Maps a live forward contract to {@link ChallengeCard} props. */
export function runContractToChallengeCard(contract: RunContract): { type: string; payload?: ChallengePayload } {
  const type = contract.type;
  if (type === "shell") {
    const cmd = contract.shell?.cmd;
    return { type: "shell", ...(cmd ? { payload: { cmd } } : {}) };
  }
  if (type === "mcp") {
    const tool_name = contract.mcp?.tool_name;
    const arguments_ = contract.mcp?.arguments;
    const hasArgsPayload =
      arguments_ !== undefined &&
      typeof arguments_ === "object" &&
      arguments_ !== null &&
      !Array.isArray(arguments_);
    return {
      type: "mcp",
      ...(tool_name || hasArgsPayload
        ? {
            payload: {
              ...(tool_name ? { tool_name } : {}),
              ...(hasArgsPayload ? { arguments: arguments_ as Record<string, unknown> } : {})
            }
          }
        : {})
    };
  }
  if (type === "user_input") {
    const prompt = contract.user_input?.prompt;
    return { type: "user_input", ...(prompt ? { payload: { prompt } } : {}) };
  }
  if (type === "comment") {
    const min_length = contract.comment?.min_length;
    return { type: "comment", ...(min_length != null ? { payload: { min_length } } : {}) };
  }
  return { type };
}
