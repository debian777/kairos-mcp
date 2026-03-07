import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ProtocolDump {
  markdown_doc: string;
  uri: string;
  label: string;
  chain_label: string | null;
  step_count?: number;
}

async function fetchProtocol(uri: string): Promise<ProtocolDump> {
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

/** Parse markdown_doc into title, steps (label + challenge type), triggers, completion. */
export function parseProtocolMarkdown(md: string): {
  title: string;
  steps: { label: string; type: string }[];
  triggers: string;
  completion: string;
} {
  const lines = md.split("\n");
  let title = "Protocol";
  const steps: { label: string; type: string }[] = [];
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
      if (jsonMatch) {
        try {
          const obj = JSON.parse(jsonMatch[1]!.trim());
          if (obj?.challenge?.type) type = obj.challenge.type;
        } catch {
          /* ignore */
        }
      }
      steps.push({ label: heading, type });
    }
  }
  return { title, steps, triggers, completion };
}
