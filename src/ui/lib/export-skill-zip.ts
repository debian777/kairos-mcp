import { apiFetch } from "@/lib/api";
import type { ExportOutput } from "../../tools/export_schema.js";

/** Result of downloading a skill ZIP (binary HTTP or legacy JSON+base64). */
export type SkillZipDownloadResult = {
  blob: Blob;
  /** JSON string of manifest when available (may omit `bundle_sha256` for streamed binary). */
  skill_bundle_manifest?: string;
};

function manifestFromHeaderBase64(b64: string | null): string | undefined {
  if (!b64 || b64.length === 0) return undefined;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return undefined;
  }
}

/** Request a server-built skill ZIP for a single adapter or layer URI. Prefers `Accept: application/zip` (streamed); falls back to JSON+base64. */
export async function fetchSkillZipBundle(uri: string): Promise<SkillZipDownloadResult> {
  const res = await apiFetch("/api/export", {
    method: "POST",
    headers: {
      Accept: "application/zip",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uri, format: "skill_zip" }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = err.message ?? res.statusText;
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/zip")) {
    const blob = await res.blob();
    const man = manifestFromHeaderBase64(res.headers.get("X-KAIROS-Skill-Bundle-Manifest"));
    return { blob, skill_bundle_manifest: man };
  }
  const json = (await res.json()) as ExportOutput;
  if (json.format !== "skill_zip" || json.content_encoding !== "base64") {
    throw new Error("Expected a skill_zip export with base64-encoded content.");
  }
  const blob = base64ToBlob(json.content, json.content_type || "application/zip");
  return { blob, skill_bundle_manifest: json.skill_bundle_manifest };
}

export function base64ToBlob(b64: string, contentType: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Prefer first skill slug from manifest; fall back to `fallbackBase`. */
export function suggestedSkillZipFilename(
  manifestJson: string | undefined,
  fallbackBase: string
): string {
  try {
    if (manifestJson) {
      const m = JSON.parse(manifestJson) as { skills?: Array<{ slug?: string }> };
      const s = m.skills?.[0]?.slug;
      if (s && s.length > 0) return `${s}-kairos-skill.zip`;
    }
  } catch {
    /* ignore */
  }
  const safe = fallbackBase.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "kairos-skill";
  return `${safe}-kairos-skill.zip`;
}
