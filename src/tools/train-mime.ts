import type { TrainInput } from './train_schema.js';
import { inferArtifactMimeFromName } from './artifact-mime.js';

export function resolveTrainMime(input: TrainInput): string | undefined {
  const explicitMime =
    typeof input.mime === 'string' && input.mime.trim().length > 0
      ? input.mime.trim()
      : undefined;
  if (explicitMime) return explicitMime;
  const artifactName =
    typeof input.artifact_name === 'string' && input.artifact_name.trim().length > 0
      ? input.artifact_name.trim()
      : '';
  const adapterUri =
    typeof input.adapter_uri === 'string' && input.adapter_uri.trim().length > 0
      ? input.adapter_uri.trim()
      : '';
  if (!artifactName || !adapterUri) return undefined;
  return inferArtifactMimeFromName(artifactName) ?? undefined;
}

