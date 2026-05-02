/**
 * Stream skill ZIP bytes on HTTP when the client requests `Accept: application/zip`.
 */

import type { Response } from 'express';
import crypto from 'node:crypto';
import { PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { collectSkillExportItemsForZip } from '../tools/export-skill-items.js';
import { resolveExportUris } from '../tools/export-selection.js';
import type { ExportInput, ExportOutput } from '../tools/export_schema.js';
import {
  finalizeExportObservation,
  runExportTelemetryContext,
  setSkillZipDecodedBytes
} from '../tools/export-telemetry.js';
import { flattenSkillItemsToZipPaths, pipeSkillZipToWritable } from '../tools/skill-export/zip-bundle.js';

const MANIFEST_HEADER_MAX = 24_000;

function wantsBinarySkillZip(accept: string | undefined): boolean {
  if (!accept || typeof accept !== 'string') return false;
  const parts = accept.split(',').map((s) => s.trim().toLowerCase());
  return parts.some((p) => p.startsWith('application/zip'));
}

/**
 * If `req.headers.accept` prefers `application/zip` and `format` is `skill_zip`, stream the ZIP
 * to `res` and return `true`. Otherwise return `false` (caller should use JSON `executeExport`).
 */
export async function tryStreamSkillZipHttpResponse(
  acceptHeader: string | undefined,
  res: Response,
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: ExportInput
): Promise<boolean> {
  if (input.format !== 'skill_zip' || !wantsBinarySkillZip(acceptHeader)) {
    return false;
  }

  return runExportTelemetryContext(async () => {
    const t0 = process.hrtime.bigint();

    try {
      const adapterUris = await resolveExportUris(memoryStore, input);
      const { items, primaryUri } = await collectSkillExportItemsForZip(memoryStore, qdrantService, adapterUris);
      const flat = flattenSkillItemsToZipPaths(items.map((it) => ({ slug: it.slug, files: it.files })));

      const manifestForHeader = {
        type: 'skill_bundle',
        format: 'zip',
        skills: items.map((it) => ({
          slug: it.slug,
          entrypoint: `${it.slug}/SKILL.md`,
          artifacts: it.files.filter((f) => f.path.startsWith('artifacts/')).map((f) => `${it.slug}/${f.path}`)
        }))
      };
      const manifestJson = JSON.stringify(manifestForHeader);
      const manifestB64 = Buffer.from(manifestJson, 'utf8').toString('base64');
      if (manifestB64.length > MANIFEST_HEADER_MAX) {
        throw new Error('Skill bundle manifest too large for X-KAIROS-Skill-Bundle-Manifest; use JSON export.');
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kairos-skills-export.zip"');
      res.setHeader('X-KAIROS-Primary-Export-Uri', primaryUri);
      res.setHeader('X-KAIROS-Export-Adapter-Count', String(items.length));
      res.setHeader('X-KAIROS-Skill-Bundle-Manifest', manifestB64);
      res.setHeader('X-KAIROS-Export-Binary', '1');

      const hash = crypto.createHash('sha256');
      let compressedBytes = 0;
      const pass = new PassThrough();
      pass.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        compressedBytes += chunk.length;
      });

      pass.pipe(res);
      await pipeSkillZipToWritable(pass, flat);
      await finished(res);

      const digest = hash.digest('hex');
      const shaLabel = `sha256:${digest}`;
      setSkillZipDecodedBytes(compressedBytes);

      const fullManifest = {
        ...manifestForHeader,
        bundle_sha256: shaLabel
      };
      const syntheticResult: ExportOutput = {
        uri: primaryUri,
        format: 'skill_zip',
        content_type: 'application/zip',
        content: '',
        item_count: items.length,
        export_adapter_count: items.length,
        bundle_sha256: shaLabel,
        skill_bundle_manifest: JSON.stringify(fullManifest),
        adapter_name: items.length === 1 ? items[0]!.name : null,
        adapter_version: items.length === 1 ? items[0]!.adapterVersion ?? null : null
      };

      finalizeExportObservation(input, syntheticResult, t0, undefined);
      return true;
    } catch (e) {
      finalizeExportObservation(input, undefined, t0, e);
      throw e;
    }
  });
}
