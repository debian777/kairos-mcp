import crypto from 'node:crypto';
import type { Memory, ProofOfWorkDefinition, ProofOfWorkType } from '../types/memory.js';
import { proofOfWorkStore, MAX_RETRIES, type ProofOfWorkResultRecord } from '../services/proof-of-work-store.js';
import { embeddingService } from '../services/embedding/service.js';
import { extractMemoryBody } from '../utils/memory-body.js';

/** Minimum cosine similarity for comment proof to pass semantic validation. Reject if below. */
const COMMENT_SEMANTIC_THRESHOLD = 0.25;

/** Hash used as proof_hash for step 1 (no prior proof). */
export const GENESIS_HASH = crypto.createHash('sha256').update('genesis').digest('hex');

function hashProofRecord(record: ProofOfWorkResultRecord): string {
  const canonical = JSON.stringify(record, Object.keys(record).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export type ProofOfWorkSubmission = {
  type: ProofOfWorkType;
  /** Nonce from challenge; must match server-issued nonce for this step. */
  nonce?: string;
  /** Proof hash from previous step's response or challenge.proof_hash for step 1. */
  proof_hash?: string;
  /** @deprecated Use proof_hash. Kept for backward compatibility. */
  previousProofHash?: string;
  shell?: {
    exit_code: number;
    stdout?: string;
    stderr?: string;
    duration_seconds?: number;
  };
  mcp?: {
    tool_name: string;
    arguments?: any;
    result: any;
    success: boolean;
  };
  user_input?: {
    confirmation: string;
    timestamp?: string;
  };
  comment?: {
    text: string;
  };
};

/** Build challenge shape from proof only (no nonce, no store). For read-only display e.g. kairos_dump. */
export function buildChallengeShapeForDisplay(proof?: ProofOfWorkDefinition): Record<string, unknown> {
  const base: Record<string, unknown> = proof ? (() => {
    const proofType: ProofOfWorkType = proof.type || 'shell';
    const result: Record<string, unknown> = { type: proofType, description: '' };
    if (proofType === 'shell') {
      const cmd = proof.shell?.cmd || proof.cmd || 'No command specified';
      const timeout = proof.shell?.timeout_seconds || proof.timeout_seconds || 30;
      result['description'] = `Execute shell command: ${cmd}`;
      result['shell'] = { cmd, timeout_seconds: timeout };
    } else if (proofType === 'mcp') {
      const toolName = proof.mcp?.tool_name || 'No tool specified';
      result['description'] = `Call MCP tool: ${toolName}`;
      result['mcp'] = { tool_name: toolName, expected_result: proof.mcp?.expected_result };
    } else if (proofType === 'user_input') {
      const prompt = proof.user_input?.prompt || 'Confirm completion';
      result['description'] = `User confirmation: ${prompt}`;
      result['user_input'] = { prompt };
    } else if (proofType === 'comment') {
      const minLength = proof.comment?.min_length || 10;
      result['description'] = `Provide a verification comment (minimum ${minLength} characters)`;
      result['comment'] = { min_length: minLength };
    }
    return result;
  })() : {
    type: 'comment' as ProofOfWorkType,
    description: 'Provide a verification comment describing how you completed this step'
  };
  base['proof_hash'] = GENESIS_HASH;
  return base;
}

export async function buildChallenge(memory: Memory | null, proof?: ProofOfWorkDefinition): Promise<any> {
  const base = buildChallengeShapeForDisplay(proof) as any;
  if (memory?.memory_uuid) {
    const nonce = crypto.randomBytes(16).toString('hex');
    await proofOfWorkStore.setNonce(memory.memory_uuid, nonce);
    base.nonce = nonce;
  }
  return base;
}

// Backward compatibility alias (deprecated - use buildChallenge)
export const buildProofOfWorkRequired = buildChallenge;

export type ElicitResult = { solution: ProofOfWorkSubmission } | { payload: any };

export async function tryUserInputElicitation(
  server: any,
  memory: Memory,
  solution: ProofOfWorkSubmission,
  requestedUri: string,
  buildCurrentStep: (m: Memory, u: string) => any
): Promise<ElicitResult> {
  if (memory.proof_of_work?.type !== 'user_input' || solution?.user_input?.confirmation) {
    return { solution };
  }
  const lowLevel = (server as { server?: { getClientCapabilities?: () => { elicitation?: unknown }; elicitInput?: (p: unknown) => Promise<{ action: string; content?: { confirmation?: string } }> } }).server;
  const caps = lowLevel?.getClientCapabilities?.();
  if (caps?.elicitation == null || typeof lowLevel?.elicitInput !== 'function') {
    return { solution };
  }
  const prompt = memory.proof_of_work.user_input?.prompt || 'Confirm completion';
  try {
    const elicitResult = await lowLevel.elicitInput({
      message: prompt,
      requestedSchema: {
        type: 'object',
        properties: { confirmation: { type: 'string', enum: ['approved', 'rejected'], description: 'Confirm or reject' } },
        required: ['confirmation']
      }
    });
    if (elicitResult?.action === 'accept' && elicitResult?.content?.confirmation) {
      return { solution: { ...solution, type: 'user_input', user_input: { confirmation: elicitResult.content.confirmation, timestamp: new Date().toISOString() } } };
    }
    const challenge = await buildChallenge(memory, memory.proof_of_work);
    const current_step = buildCurrentStep(memory, requestedUri);
    if (elicitResult?.action === 'decline') {
      return { payload: buildErrorPayload(memory, current_step, challenge, 'User declined confirmation.', 'USER_DECLINED', 1) };
    }
    return { payload: buildErrorPayload(memory, current_step, challenge, 'User cancelled or did not confirm.', 'USER_DECLINED', 1) };
  } catch (err) {
    const challenge = await buildChallenge(memory, memory.proof_of_work);
    return { payload: buildErrorPayload(memory, buildCurrentStep(memory, requestedUri), challenge, err instanceof Error ? err.message : 'Elicitation failed.', 'ELICITATION_FAILED', 1) };
  }
}

/**
 * Build an error response payload with two-phase retry escalation.
 * Retries 1-3: must_obey true with recovery next_action.
 * After 3: must_obey false with autonomous options.
 */
function buildErrorPayload(
  memory: Memory | null,
  current_step: any,
  challenge: any,
  message: string,
  errorCode: string,
  retryCount: number
): any {
  const uuid = memory?.memory_uuid;
  const uri = uuid ? `kairos://mem/${uuid}` : '';
  const maxExceeded = retryCount >= MAX_RETRIES;

  const payload: any = {
    must_obey: !maxExceeded,
    current_step,
    challenge,
    message: maxExceeded
      ? `Step failed ${retryCount} times. Use your judgment to recover.`
      : message,
    error_code: maxExceeded ? 'MAX_RETRIES_EXCEEDED' : errorCode,
    retry_count: retryCount
  };

  if (maxExceeded && uri) {
    payload.next_action = `Options: (1) call kairos_update with ${uri} to fix the step for future executions (2) call kairos_attest with ${uri} and outcome failure to abort (3) ask the user for help`;
  } else if (uri) {
    payload.next_action = `retry kairos_next with ${uri} -- use nonce and proof_hash from THIS response's challenge`;
  }

  return payload;
}

export type HandleProofOptions = {
  /** Expected proof_hash: GENESIS_HASH for step 1, or stored hash of previous step's proof. */
  expectedPreviousHash: string;
};

export type HandleProofResult = { blockedPayload?: any; proofHash?: string; alreadyRecorded?: boolean };

export async function handleProofSubmission(
  submission: ProofOfWorkSubmission,
  memory: Memory,
  options?: HandleProofOptions
): Promise<HandleProofResult> {
  if (!memory?.proof_of_work) {
    return {};
  }

  const uuid = memory.memory_uuid;
  const proofType: ProofOfWorkType = submission.type || 'shell';
  const requiredType: ProofOfWorkType = memory.proof_of_work.type || 'shell';

  // Accept both proof_hash (v2) and previousProofHash (v1 compat)
  const submittedProofHash = submission.proof_hash ?? submission.previousProofHash;

  // Helper to build error with retry counting
  const blocked = async (msg: string, code: string, currentStep?: any, challengeObj?: any) => {
    const retryCount = await proofOfWorkStore.incrementRetry(uuid);
    const cs = currentStep || { uri: `kairos://mem/${uuid}`, content: '', mimeType: 'text/markdown' };
    const ch = challengeObj || await buildChallenge(memory, memory.proof_of_work);
    return {
      blockedPayload: buildErrorPayload(memory, cs, ch, msg, code, retryCount)
    };
  };

  // Nonce validation
  if (memory.memory_uuid) {
    const storedNonce = await proofOfWorkStore.getNonce(memory.memory_uuid);
    if (storedNonce != null) {
      if (submission.nonce !== storedNonce) {
        return blocked('Nonce mismatch. Use the nonce from the current step challenge.', 'NONCE_MISMATCH');
      }
    }
  }

  // Proof hash validation
  if (options?.expectedPreviousHash != null && submittedProofHash !== undefined) {
    if (submittedProofHash !== options.expectedPreviousHash) {
      return blocked('proof_hash mismatch. Use proof_hash from the previous response or challenge.', 'PROOF_HASH_MISMATCH');
    }
  }
  if (options?.expectedPreviousHash != null && submittedProofHash === undefined) {
    return blocked('Include proof_hash in solution (use challenge.proof_hash for step 1).', 'MISSING_FIELD');
  }

  // Type validation
  if (proofType !== requiredType && requiredType !== undefined) {
    return blocked(`Expected proof type: ${requiredType}, got: ${proofType}`, 'TYPE_MISMATCH');
  }

  // Build result record
  const record: ProofOfWorkResultRecord = {
    result_id: `pow_${uuid}_${Date.now()}`,
    type: proofType,
    status: 'success',
    executed_at: new Date().toISOString()
  };

  if (proofType === 'shell') {
    const shell = submission.shell;
    if (!shell) {
      return blocked('Shell proof requires shell field with exit_code', 'MISSING_FIELD');
    }
    record.status = shell.exit_code === 0 ? 'success' : 'failed';
    record.shell = {
      exit_code: shell.exit_code,
      ...(shell.stdout !== undefined && { stdout: shell.stdout }),
      ...(shell.stderr !== undefined && { stderr: shell.stderr }),
      ...(shell.duration_seconds !== undefined && { duration_seconds: shell.duration_seconds })
    };
    record.exit_code = shell.exit_code;
    if (shell.stdout !== undefined) record.stdout = shell.stdout;
    if (shell.stderr !== undefined) record.stderr = shell.stderr;
    if (shell.duration_seconds !== undefined) record.duration_seconds = shell.duration_seconds;
  } else if (proofType === 'mcp') {
    const mcp = submission.mcp;
    if (!mcp) {
      return blocked('MCP proof requires mcp field', 'MISSING_FIELD');
    }
    record.status = mcp.success ? 'success' : 'failed';
    record.mcp = {
      tool_name: mcp.tool_name,
      arguments: mcp.arguments,
      result: mcp.result,
      success: mcp.success
    };
  } else if (proofType === 'user_input') {
    const userInput = submission.user_input;
    if (!userInput || !userInput.confirmation) {
      return blocked('User input proof requires user_input.confirmation', 'MISSING_FIELD');
    }
    record.status = 'success';
    record.user_input = {
      confirmation: userInput.confirmation,
      timestamp: userInput.timestamp || new Date().toISOString()
    };
  } else if (proofType === 'comment') {
    const comment = submission.comment;
    if (!comment || !comment.text) {
      return blocked('Comment proof requires comment.text', 'MISSING_FIELD');
    }
    const minLength = memory.proof_of_work.comment?.min_length || 10;
    if (comment.text.length < minLength) {
      return blocked(`Comment must be at least ${minLength} characters`, 'COMMENT_TOO_SHORT');
    }
    // Semantic validation
    const stepContent = extractMemoryBody(memory.text) || String(memory.label || '').trim();
    if (stepContent.length >= 20) {
      try {
        const [commentEmb, stepEmb] = await Promise.all([
          embeddingService.generateEmbedding(comment.text.trim()),
          embeddingService.generateEmbedding(stepContent.slice(0, 8000))
        ]);
        const similarity = embeddingService.calculateCosineSimilarity(commentEmb.embedding, stepEmb.embedding);
        if (similarity < COMMENT_SEMANTIC_THRESHOLD) {
          return blocked(
            `Comment does not appear relevant to this step (similarity ${similarity.toFixed(2)} < ${COMMENT_SEMANTIC_THRESHOLD}). Provide a response that engages with the step content.`,
            'COMMENT_IRRELEVANT'
          );
        }
      } catch (_err) {
        // Fail open: if embedding unavailable, allow length-valid comments
      }
    }
    record.status = 'success';
    record.comment = { text: comment.text };
  }

  // Idempotency: if we already have a successful result for this step, return existing hash and skip re-saving (avoids double quality update)
  const existing = await proofOfWorkStore.getResult(uuid);
  if (existing?.status === 'success') {
    const proofHash = await proofOfWorkStore.getProofHash(uuid);
    return proofHash ? { proofHash, alreadyRecorded: true } : { proofHash: hashProofRecord(record) };
  }

  await proofOfWorkStore.saveResult(uuid, record);
  const proofHash = hashProofRecord(record);
  await proofOfWorkStore.setProofHash(uuid, proofHash);

  if (memory.proof_of_work.required && record.status === 'failed') {
    return blocked('Proof of work failed. Fix and retry.', 'COMMAND_FAILED');
  }

  // Success -- reset retry counter
  await proofOfWorkStore.resetRetry(uuid);

  return { proofHash };
}
