import type { Memory } from '../types/memory.js';
import { buildChallenge, buildErrorPayload, type ProofOfWorkSubmission } from './kairos_next-pow-helpers.js';

export type ElicitResult = { solution: ProofOfWorkSubmission } | { payload: any };

export async function tryUserInputElicitation(
  server: any,
  memory: Memory,
  solution: ProofOfWorkSubmission,
  requestedUri: string,
  buildCurrentStep: (m: Memory, u: string) => any
): Promise<ElicitResult> {
  // Only handle user_input steps
  if (memory.proof_of_work?.type !== 'user_input') {
    return { solution };
  }

  // Strict requirement: client MUST support elicitation capability
  const lowLevel = (server as { server?: { getClientCapabilities?: () => { elicitation?: unknown }; elicitInput?: (p: unknown) => Promise<{ action: string; content?: { confirmation?: string } }> } }).server;
  const caps = lowLevel?.getClientCapabilities?.();
  
  if (caps?.elicitation == null || typeof lowLevel?.elicitInput !== 'function') {
    // Hard failure: client does not support elicitation, which is required for user_input steps
    const challenge = await buildChallenge(memory, memory.proof_of_work);
    const current_step = buildCurrentStep(memory, requestedUri);
    return {
      payload: {
        must_obey: false,
        current_step,
        challenge,
        message: 'This protocol step requires user confirmation. The MCP client must support the elicitation capability to proceed. Please configure your client to support elicitation or use a different client.',
        error_code: 'CAPABILITY_REQUIRED',
        retry_count: 0,
        next_action: `This step cannot proceed without client elicitation support. The client must support the elicitation capability to run protocols with user_input steps.`
      }
    };
  }

  const prompt = memory.proof_of_work.user_input?.prompt || 'Confirm completion';
  try {
    const elicitResult = await lowLevel.elicitInput({
      message: prompt,
      requestedSchema: {
        type: 'object',
        properties: {
          confirmation: {
            type: 'string',
            enum: ['approve', 'retry_last_step', 'retry_chain', 'abort'],
            description: 'User action: approve to continue, retry_last_step to retry current step, retry_chain to restart protocol, abort to cancel'
          }
        },
        required: ['confirmation']
      }
    });
    
    if (elicitResult?.action === 'accept' && elicitResult?.content?.confirmation) {
      const confirmation = elicitResult.content.confirmation;
      
      // Handle different user actions
      if (confirmation === 'approve') {
        // Success: build solution and advance
        return { solution: { ...solution, type: 'user_input', user_input: { confirmation: 'approved', timestamp: new Date().toISOString() } } };
      } else if (confirmation === 'retry_last_step') {
        // User wants to retry current step
        const challenge = await buildChallenge(memory, memory.proof_of_work);
        const current_step = buildCurrentStep(memory, requestedUri);
        return { payload: buildErrorPayload(memory, current_step, challenge, 'User requested to retry the last step.', 'USER_DECLINED', 1) };
      } else if (confirmation === 'retry_chain') {
        // User wants to restart the chain
        const challenge = await buildChallenge(memory, memory.proof_of_work);
        const current_step = buildCurrentStep(memory, requestedUri);
        // Find chain head URI (would need chain info, but for now return error with instruction)
        return {
          payload: {
            must_obey: true,
            current_step,
            challenge,
            message: 'User requested to restart the protocol chain.',
            error_code: 'USER_DECLINED',
            retry_count: 1,
            next_action: `call kairos_begin with the chain's base URI to restart the protocol`
          }
        };
      } else if (confirmation === 'abort') {
        // User wants to abort
        const challenge = await buildChallenge(memory, memory.proof_of_work);
        const current_step = buildCurrentStep(memory, requestedUri);
        return {
          payload: {
            must_obey: true,
            current_step,
            challenge,
            message: 'User requested to abort the protocol.',
            error_code: 'USER_DECLINED',
            retry_count: 1,
            next_action: `call kairos_attest with ${requestedUri} and outcome failure to abort the protocol`
          }
        };
      }
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
