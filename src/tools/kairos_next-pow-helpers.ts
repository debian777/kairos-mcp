import type { Memory, ProofOfWorkDefinition, ProofOfWorkType } from '../types/memory.js';
import { proofOfWorkStore, type ProofOfWorkResultRecord } from '../services/proof-of-work-store.js';

export type ProofOfWorkSubmission = {
  type: ProofOfWorkType;
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

export function buildProofOfWorkRequired(proof?: ProofOfWorkDefinition): any {
  if (!proof) {
    // Default to comment type if no proof defined
    return {
      type: 'comment' as ProofOfWorkType,
      description: 'Provide a verification comment describing how you completed this step'
    };
  }

  const proofType: ProofOfWorkType = proof.type || 'shell';
  const result: any = {
    type: proofType,
    description: ''
  };

  if (proofType === 'shell') {
    const cmd = proof.shell?.cmd || proof.cmd || 'No command specified';
    const timeout = proof.shell?.timeout_seconds || proof.timeout_seconds || 30;
    result.description = `Execute shell command: ${cmd}`;
    result.shell = { cmd, timeout_seconds: timeout };
  } else if (proofType === 'mcp') {
    const toolName = proof.mcp?.tool_name || 'No tool specified';
    result.description = `Call MCP tool: ${toolName}`;
    result.mcp = { tool_name: toolName, expected_result: proof.mcp?.expected_result };
  } else if (proofType === 'user_input') {
    const prompt = proof.user_input?.prompt || 'Confirm completion';
    result.description = `User confirmation: ${prompt}`;
    result.user_input = { prompt };
  } else if (proofType === 'comment') {
    const minLength = proof.comment?.min_length || 10;
    result.description = `Provide a verification comment (minimum ${minLength} characters)`;
    result.comment = { min_length: minLength };
  }

  return result;
}

export async function handleProofSubmission(
  submission: ProofOfWorkSubmission,
  memory: Memory
): Promise<{ blockedPayload?: any }> {
  if (!memory?.proof_of_work) {
    return {};
  }

  const uuid = memory.memory_uuid;
  const proofType: ProofOfWorkType = submission.type || 'shell';
  const requiredType: ProofOfWorkType = memory.proof_of_work.type || 'shell';

  // Validate proof type matches requirement
  if (proofType !== requiredType && requiredType !== undefined) {
    return {
      blockedPayload: {
        must_obey: false,
        message: `Expected proof type: ${requiredType}, got: ${proofType}`,
        protocol_status: 'blocked'
      }
    };
  }

  // Build result record based on type
  const record: ProofOfWorkResultRecord = {
    result_id: `pow_${uuid}_${Date.now()}`,
    type: proofType,
    status: 'success', // Will be set based on type below
    executed_at: new Date().toISOString()
  };

  if (proofType === 'shell') {
    const shell = submission.shell;
    if (!shell) {
      return {
        blockedPayload: {
          must_obey: false,
          message: 'Shell proof requires shell field with exit_code',
          protocol_status: 'blocked'
        }
      };
    }
    record.status = shell.exit_code === 0 ? 'success' : 'failed';
    record.shell = {
      exit_code: shell.exit_code,
      ...(shell.stdout !== undefined && { stdout: shell.stdout }),
      ...(shell.stderr !== undefined && { stderr: shell.stderr }),
      ...(shell.duration_seconds !== undefined && { duration_seconds: shell.duration_seconds })
    };
    // Backward compatibility
    record.exit_code = shell.exit_code;
    if (shell.stdout !== undefined) record.stdout = shell.stdout;
    if (shell.stderr !== undefined) record.stderr = shell.stderr;
    if (shell.duration_seconds !== undefined) record.duration_seconds = shell.duration_seconds;
  } else if (proofType === 'mcp') {
    const mcp = submission.mcp;
    if (!mcp) {
      return {
        blockedPayload: {
          must_obey: false,
          message: 'MCP proof requires mcp field',
          protocol_status: 'blocked'
        }
      };
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
      return {
        blockedPayload: {
          must_obey: false,
          message: 'User input proof requires user_input.confirmation',
          protocol_status: 'blocked'
        }
      };
    }
    record.status = 'success'; // User confirmation is always success
    record.user_input = {
      confirmation: userInput.confirmation,
      timestamp: userInput.timestamp || new Date().toISOString()
    };
  } else if (proofType === 'comment') {
    const comment = submission.comment;
    if (!comment || !comment.text) {
      return {
        blockedPayload: {
          must_obey: false,
          message: 'Comment proof requires comment.text',
          protocol_status: 'blocked'
        }
      };
    }
    const minLength = memory.proof_of_work.comment?.min_length || 10;
    if (comment.text.length < minLength) {
      return {
        blockedPayload: {
          must_obey: false,
          message: `Comment must be at least ${minLength} characters`,
          protocol_status: 'blocked'
        }
      };
    }
    record.status = 'success'; // Comment verification is always success
    record.comment = { text: comment.text };
  }

  await proofOfWorkStore.saveResult(uuid, record);

  if (memory.proof_of_work.required && record.status === 'failed') {
    return {
      blockedPayload: {
        must_obey: false,
        message: 'Proof of work failed. Fix and retry.',
        protocol_status: 'blocked'
      }
    };
  }

  return {};
}

