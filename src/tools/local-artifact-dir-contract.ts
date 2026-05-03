/** JSON field: lowercase snake of env var `KAIROS_LOCAL_ARTIFACT_DIR`. */
export const KAIROS_LOCAL_ARTIFACT_DIR_JSON_FIELD = 'kairos_local_artifact_dir';

export function buildLocalArtifactDirFields(
  localArtifactDir: string
): Record<typeof KAIROS_LOCAL_ARTIFACT_DIR_JSON_FIELD, string> {
  return {
    [KAIROS_LOCAL_ARTIFACT_DIR_JSON_FIELD]: localArtifactDir
  };
}
