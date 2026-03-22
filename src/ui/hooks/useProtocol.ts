import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { DumpOutput } from "../../tools/kairos_dump_schema.js";

async function fetchProtocol(uri: string): Promise<DumpOutput> {
  const res = await apiFetch("/api/kairos_dump", {
    method: "POST",
    body: JSON.stringify({ uri, protocol: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message ?? res.statusText;
    const e = new Error(msg) as Error & { statusCode?: number };
    e.statusCode = res.status;
    throw e;
  }
  return res.json();
}

export function useProtocol(uri: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["protocol", uri],
    queryFn: () => fetchProtocol(uri!),
    enabled: Boolean(uri && enabled),
  });
}

export interface ParsedStep {
  label: string;
  type: string;
  summary: string;
  /** Raw section body (for expand/copy). */
  body: string;
}

/** Per-step form state for the protocol editor. */
export interface StepFormState {
  label: string;
  bodyMarkdown: string;
  type: "shell" | "mcp" | "user_input" | "comment";
  shell?: {
    cmd: string;
    timeout_seconds: number;
    interpreter?: string;
    workdir?: string;
    flags: string[];
    args: string[];
  };
  mcp?: { tool_name: string };
  user_input?: { prompt: string };
  comment?: { min_length: number };
}

/** Form state for the full protocol editor. */
export interface ProtocolFormState {
  protocolLabel: string;
  triggersMarkdown: string;
  steps: StepFormState[];
  completionMarkdown: string;
}

/** Parse markdown_doc into title, steps (label + challenge type + body), triggers, completion. */
export function parseProtocolMarkdown(md: string): {
  title: string;
  steps: ParsedStep[];
  triggers: string;
  completion: string;
} {
  const lines = md.split("\n");
  let title = "Protocol";
  const steps: ParsedStep[] = [];
  let triggers = "";
  let completion = "";

  const h1Match = lines.find((l) => l.startsWith("# "));
  if (h1Match) title = h1Match.replace(/^#\s+/, "").trim();

  const sections = md.split(/\n##\s+/);
  for (let i = 1; i < sections.length; i++) {
    const block = sections[i]!;
    const firstLine = block.split("\n")[0] ?? "";
    const heading = firstLine.trim();
    const body = block.slice(firstLine.length).replace(/^\n+/, "").trim();
    if (heading.toLowerCase().includes("natural language trigger")) {
      triggers = body.replace(/\n```json[\s\S]*?```/g, "").trim();
    } else if (heading.toLowerCase().includes("completion rule")) {
      completion = body.replace(/\n```json[\s\S]*?```/g, "").trim();
    } else {
      const jsonMatch = body.match(/```json\s*([\s\S]*?)```/);
      let type = "comment";
      let summary = "Comment";
      if (jsonMatch) {
        try {
          const obj = JSON.parse(jsonMatch[1]!.trim());
          const challenge = obj?.challenge ?? obj;
          if (challenge?.type) type = String(challenge.type);
          if (type === "shell") {
            const cmd = challenge?.shell?.cmd ?? challenge?.cmd;
            const interp = challenge?.shell?.interpreter;
            summary = cmd
              ? interp
                ? `Shell (${interp}): ${String(cmd).slice(0, 60)}${String(cmd).length > 60 ? "…" : ""}`
                : `Shell: ${String(cmd).slice(0, 80)}${String(cmd).length > 80 ? "…" : ""}`
              : "Shell";
          } else if (type === "mcp") {
            const tool = challenge?.mcp?.tool_name;
            summary = tool ? `MCP: ${String(tool)}` : "MCP";
          } else if (type === "user_input") {
            const prompt = challenge?.user_input?.prompt;
            summary = prompt ? `User input: ${String(prompt)}` : "User input";
          } else if (type === "comment") {
            const min = challenge?.comment?.min_length;
            summary = min ? `Comment: min ${Number(min)} chars` : "Comment";
          } else {
            summary = String(type);
          }
        } catch {
          /* ignore */
        }
      }
      if (!summary) summary = String(type);
      steps.push({ label: heading, type, summary, body });
    }
  }
  return { title, steps, triggers, completion };
}

/** Parse markdown into form state for the protocol editor. */
export function parseProtocolMarkdownToForm(md: string): ProtocolFormState {
  const { title, steps, triggers, completion } = parseProtocolMarkdown(md);
  const stepStates: StepFormState[] = steps.map((step) => {
    const bodyMarkdown = step.body.replace(/\n```json\s*[\s\S]*?```\s*$/g, "").trim();
    let type: StepFormState["type"] = "comment";
    const stepState: StepFormState = { label: step.label, bodyMarkdown, type };
    const jsonMatch = step.body.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[1]!.trim());
        const challenge = obj?.challenge ?? obj;
        if (challenge?.type && ["shell", "mcp", "user_input", "comment"].includes(String(challenge.type))) {
          type = challenge.type as StepFormState["type"];
          stepState.type = type;
        }
        if (type === "shell") {
          const sh = challenge?.shell;
          stepState.shell = {
            cmd: String(sh?.cmd ?? challenge?.cmd ?? "").trim(),
            timeout_seconds: Number(sh?.timeout_seconds ?? 30),
            interpreter: typeof sh?.interpreter === "string" ? sh.interpreter : undefined,
            workdir: typeof sh?.workdir === "string" ? sh.workdir : undefined,
            flags: Array.isArray(sh?.flags) ? sh.flags.map(String) : [],
            args: Array.isArray(sh?.args) ? sh.args.map(String) : [],
          };
        }
        else if (type === "mcp") stepState.mcp = { tool_name: String(challenge?.mcp?.tool_name ?? "").trim() };
        else if (type === "user_input") stepState.user_input = { prompt: String(challenge?.user_input?.prompt ?? "").trim() };
        else if (type === "comment") stepState.comment = { min_length: Number(challenge?.comment?.min_length ?? 10) };
      } catch {
        /* ignore */
      }
    }
    return stepState;
  });
  return {
    protocolLabel: title,
    triggersMarkdown: triggers,
    steps: stepStates,
    completionMarkdown: completion,
  };
}

/** Build markdown from protocol form state. */
export function buildMarkdownFromForm(state: ProtocolFormState): string {
  const lines: string[] = [];
  lines.push(`# ${state.protocolLabel.trim() || "Protocol"}`);
  lines.push("");
  lines.push("## Natural language triggers");
  lines.push("");
  lines.push(state.triggersMarkdown.trim() || "Describe when this protocol should run.");
  lines.push("");
  for (const step of state.steps) {
    lines.push(`## ${step.label.trim() || "Step"}`);
    lines.push("");
    lines.push(step.bodyMarkdown.trim() || "Step content.");
    const challenge: Record<string, unknown> = { type: step.type };
    if (step.type === "shell") {
      const shell: Record<string, unknown> = {
        cmd: step.shell?.cmd ?? "",
        timeout_seconds: step.shell?.timeout_seconds ?? 30,
      };
      const interp = step.shell?.interpreter?.trim();
      if (interp) shell.interpreter = interp;
      const wd = step.shell?.workdir?.trim();
      if (wd) shell.workdir = wd;
      if (step.shell?.flags?.length) shell.flags = step.shell.flags;
      if (step.shell?.args?.length) shell.args = step.shell.args;
      challenge.shell = shell;
    }
    else if (step.type === "mcp") challenge.mcp = { tool_name: step.mcp?.tool_name ?? "" };
    else if (step.type === "user_input") challenge.user_input = { prompt: step.user_input?.prompt ?? "" };
    else if (step.type === "comment") challenge.comment = { min_length: step.comment?.min_length ?? 10 };
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify({ challenge }, null, 2));
    lines.push("```");
    lines.push("");
  }
  lines.push("## Completion rule");
  lines.push("");
  lines.push(state.completionMarkdown.trim() || "When is this protocol considered complete?");
  return lines.join("\n");
}
