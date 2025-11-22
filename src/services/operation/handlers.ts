import { QdrantService } from '../qdrant/service.js';
import { OperationDetectionResult } from './types.js';
import {
  parseKbName,
  validateAndExtractStepFromTarget,
  validateTargetExists
} from './utils.js';
import { findExistingProtocol } from './protocol.js';

/**
 * Handle explicit operations with proper validation and step management
 */
export async function handleExplicitOperation(
  qdrantService: QdrantService,
  operation: string,
  target: string | undefined,
  input: string | string[],
  kbName: string
): Promise<OperationDetectionResult> {
  // Validate target exists for operations that require it
  if (target && ['replace', 'insert-before', 'insert-after'].includes(operation)) {
    const targetExists = await validateTargetExists(qdrantService, target, kbName);
    if (!targetExists) {
      throw new Error(`Target "${target}" does not exist for ${operation} operation`);
    }
  }

  // Handle each explicit operation type
  switch (operation) {
    case 'create':
      return handleCreateOperation(input, kbName);
    case 'replace':
      return handleReplaceOperation(target, input, kbName);
    case 'insert-before':
      return handleInsertBeforeOperation(target, input, kbName);
    case 'insert-after':
      return handleInsertAfterOperation(target, input, kbName);
    case 'append':
      // For append, if target is provided, validate it refers to the end of protocol
      if (target) {
        return await handleAppendWithTarget(qdrantService, target, input, kbName);
      } else {
        return await handleAppendOperation(qdrantService, input, kbName);
      }
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

/**
 * Handle replace operation - replace content at specific memory
 */
export function handleReplaceOperation(target: string | undefined, input: string | string[], kbName: string): OperationDetectionResult {
  if (!target) {
    throw new Error('Target is required for replace operation');
  }

  const targetMemory = validateAndExtractStepFromTarget(target);
  const { domain, task } = parseKbName(kbName);
  const targetUri = `kairos://${domain}/${task}/memory/${targetMemory}`;

  return {
    operation: 'replace',
    confidence: 0.95,
    reasoning: `Replace operation targeting memory ${targetMemory} in ${domain}/${task}`,
    target: targetUri,
    requiresExplicit: false
  };
}

/**
 * Handle insert-before operation - insert content before specified memory
 */
export function handleInsertBeforeOperation(target: string | undefined, input: string | string[], kbName: string): OperationDetectionResult {
  if (!target) {
    throw new Error('Target is required for insert-before operation');
  }

  const targetMemory = validateAndExtractStepFromTarget(target);
  const { domain, task } = parseKbName(kbName);
  const targetUri = `kairos://${domain}/${task}/memory/${targetMemory}`;

  return {
    operation: 'insert-before',
    confidence: 0.95,
    reasoning: `Insert-before operation targeting memory ${targetMemory} in ${domain}/${task}`,
    target: targetUri,
    requiresExplicit: false
  };
}

/**
 * Handle insert-after operation - insert content after specified memory
 */
export function handleInsertAfterOperation(target: string | undefined, input: string | string[], kbName: string): OperationDetectionResult {
  if (!target) {
    throw new Error('Target is required for insert-after operation');
  }

  const targetMemory = validateAndExtractStepFromTarget(target);
  const { domain, task } = parseKbName(kbName);
  const targetUri = `kairos://${domain}/${task}/memory/${targetMemory}`;

  return {
    operation: 'insert-after',
    confidence: 0.95,
    reasoning: `Insert-after operation targeting memory ${targetMemory} in ${domain}/${task}`,
    target: targetUri,
    requiresExplicit: false
  };
}

/**
 * Handle append operation with explicit target
 */
export async function handleAppendWithTarget(
  qdrantService: QdrantService,
  target: string,
  input: string | string[],
  kbName: string
): Promise<OperationDetectionResult> {
  const targetMemory = validateAndExtractStepFromTarget(target);

  // For append with target, validate it's pointing to the end of protocol
  const protocolInfo = await findExistingProtocol(qdrantService, kbName);
  if (protocolInfo && targetMemory !== protocolInfo.totalSteps + 1) {
    throw new Error(`Target ${targetMemory} is not the next memory. Protocol has ${protocolInfo.totalSteps} memories.`);
  }

  const { domain, task } = parseKbName(kbName);
  const nextMemory = targetMemory;
  const targetUri = `kairos://${domain}/${task}/memory/${nextMemory}`;

  return {
    operation: 'append',
    confidence: 0.9,
    reasoning: `Append operation to explicit memory ${nextMemory} in ${domain}/${task}`,
    target: targetUri,
    requiresExplicit: false
  };
}

/**
 * Handle create operation - create new protocol
 */
export function handleCreateOperation(input: string | string[], kbName: string): OperationDetectionResult {
  const { domain, task } = parseKbName(kbName);
  const targetUri = `kairos://${domain}/${task}/memory/1`; // First memory of new protocol

  return {
    operation: 'create',
    confidence: 0.95,
    reasoning: `Create operation for new protocol ${domain}/${task}`,
    target: targetUri,
    requiresExplicit: false
  };
}

/**
 * Handle append operation (no target specified)
 */
export async function handleAppendOperation(
  qdrantService: QdrantService,
  input: string | string[],
  kbName: string
): Promise<OperationDetectionResult> {
  const protocolInfo = await findExistingProtocol(qdrantService, kbName);
  if (!protocolInfo) {
    throw new Error('No existing protocol found for append operation. Use create operation instead.');
  }

  const nextMemory = protocolInfo.totalSteps + 1;
  const { domain, task } = parseKbName(kbName);
  const targetUri = `kairos://${domain}/${task}/memory/${nextMemory}`;

  return {
    operation: 'append',
    confidence: 0.9,
    reasoning: `Append operation to next memory ${nextMemory} in ${domain}/${task}`,
    target: targetUri,
    requiresExplicit: false
  };
}