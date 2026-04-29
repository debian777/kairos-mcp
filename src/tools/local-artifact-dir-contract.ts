import { z } from 'zod';

export const LOCAL_ARTIFACT_DIR_FIELD = 'local_artifact_dir';
export const COMPAT_LOCAL_ARTIFACT_DIR_FIELD = 'kairos_work_dir';
export const LOCAL_ARTIFACT_DIR_ENV = 'KAIROS_LOCAL_ARTIFACT_DIR';
export const COMPAT_LOCAL_ARTIFACT_DIR_ENV = 'KAIROS_WORK_DIR';

export const deprecationNoticeSchema = z.object({
  kind: z.literal('input_alias'),
  compat_name: z.string(),
  replacement_name: z.string(),
  status: z.literal('deprecated'),
  migration_message: z.string(),
  requires_user_permission: z.boolean(),
  suggested_next_action: z.string()
});

export type DeprecationNotice = z.infer<typeof deprecationNoticeSchema>;

export function buildLocalArtifactDirDeprecationNotice(): DeprecationNotice {
  return {
    kind: 'input_alias',
    compat_name: COMPAT_LOCAL_ARTIFACT_DIR_ENV,
    replacement_name: LOCAL_ARTIFACT_DIR_ENV,
    status: 'deprecated',
    migration_message:
      `${COMPAT_LOCAL_ARTIFACT_DIR_ENV} remains accepted as a compat alias, ` +
      `but new adapters, protocol text, and agent flows must use ` +
      `${LOCAL_ARTIFACT_DIR_ENV} / ${LOCAL_ARTIFACT_DIR_FIELD}. Continue the ` +
      `current run with the resolved directory and ask the user for permission ` +
      `before updating stored adapters, protocols, or docs.`,
    requires_user_permission: true,
    suggested_next_action:
      `Keep using the current local artifact directory for this run, then ask ` +
      `the user whether to migrate compat ${COMPAT_LOCAL_ARTIFACT_DIR_ENV} ` +
      `references to ${LOCAL_ARTIFACT_DIR_ENV}.`
  };
}

export function buildLocalArtifactDirFields(
  localArtifactDir: string
): Record<typeof LOCAL_ARTIFACT_DIR_FIELD | typeof COMPAT_LOCAL_ARTIFACT_DIR_FIELD, string> {
  return {
    [LOCAL_ARTIFACT_DIR_FIELD]: localArtifactDir,
    [COMPAT_LOCAL_ARTIFACT_DIR_FIELD]: localArtifactDir
  };
}

export function maybeBuildLocalArtifactDirDeprecations(
  compatAliasUsed: boolean
): DeprecationNotice[] | undefined {
  return compatAliasUsed ? [buildLocalArtifactDirDeprecationNotice()] : undefined;
}

export function appendLocalArtifactDirDeprecationMessage(
  message: string | undefined,
  compatAliasUsed: boolean
): string | undefined {
  if (!compatAliasUsed) return message;
  const warning =
    `Deprecated compat alias detected: ${COMPAT_LOCAL_ARTIFACT_DIR_ENV}. ` +
    `Keep the current local artifact directory for this run. Ask the user for ` +
    `permission before updating stored adapters, protocols, or docs to ` +
    `${LOCAL_ARTIFACT_DIR_ENV} / ${LOCAL_ARTIFACT_DIR_FIELD}.`;
  return message ? `${message}\n\n${warning}` : warning;
}

