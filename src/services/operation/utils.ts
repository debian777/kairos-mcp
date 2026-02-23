import { QdrantService } from '../qdrant/service.js';
import { logger } from '../../utils/logger.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';

/**
 * Parse kbName into domain/task components
 */
export function parseKbName(kbName: string): { domain: string; task: string } {
  // Parse hierarchical kb_name like "ai/coding/rules" or "docker/security"
  const parts = kbName.split('/').map(part => part.trim().toLowerCase());

  if (parts.length === 1) {
    // Single part - treat as domain, generate task from content
    return {
      domain: parts[0] || 'general',
      task: 'general'
    };
  } else if (parts.length >= 2) {
    // Multiple parts - domain/task hierarchy
    return {
      domain: parts[0] || 'general',
      task: parts.slice(1).join('_') || 'general'
    };
  }

  return { domain: 'general', task: 'general' };
}

/**
 * Generate URI for a new memory in a protocol
 */
export function generateMemoryUri(kbName: string, memoryNumber: number): string {
  const { domain, task } = parseKbName(kbName);
  return `kairos://${domain}/${task}/memory/${memoryNumber}`;
}

/**
 * Generate URI for protocol root
 */
export function generateProtocolUri(domain: string, task: string): string {
  return `kairos://${domain}/${task}`;
}

/**
 * Validate and extract step number from target string
 * Accepts: "step/3", "3", "kairos://domain/type/task/step/3", "kairos://path/step/3"
 * Also supports legacy "memory/X" format for backward compatibility
 */
export function validateAndExtractStepFromTarget(target: string): number {
  if (!target || typeof target !== 'string' || target.trim().length === 0) {
    throw new Error('Target parameter is required and must be a non-empty string for replace/insert operations');
  }

  const trimmedTarget = target.trim();

  // Handle direct step references: "step/3"
  const stepMatch = trimmedTarget.match(/^step\/(\d+)$/);
  if (stepMatch && stepMatch[1]) {
    const step = parseInt(stepMatch[1], 10);
    if (step < 1) {
      throw new Error(`Invalid step number: ${step}. Step numbers must be positive integers starting from 1`);
    }
    return step;
  }

  // Handle legacy memory references: "memory/3"
  const memoryMatch = trimmedTarget.match(/^memory\/(\d+)$/);
  if (memoryMatch && memoryMatch[1]) {
    const step = parseInt(memoryMatch[1], 10);
    if (step < 1) {
      throw new Error(`Invalid memory number: ${step}. Memory numbers must be positive integers starting from 1`);
    }
    return step;
  }

  // Handle direct step numbers: "3"
  const numberMatch = trimmedTarget.match(/^(\d+)$/);
  if (numberMatch && numberMatch[1]) {
    const step = parseInt(numberMatch[1], 10);
    if (step < 1) {
      throw new Error(`Invalid step number: ${step}. Step numbers must be positive integers starting from 1`);
    }
    return step;
  }

  // Handle full URIs: "kairos://domain/type/task/step/3" or "kairos://path/step/3"
  if (trimmedTarget.startsWith('kairos://')) {
    const uriParts = trimmedTarget.substring(5).split('/'); // Remove 'kairos://' prefix

    // Find the last 'step' segment and the following number
    const stepIndex = uriParts.lastIndexOf('step');
    if (stepIndex === -1 || stepIndex === uriParts.length - 1) {
      throw new Error(`Invalid URI format: ${trimmedTarget}. URI must contain '/step/{number}' at the end`);
    }

    const stepStr = uriParts[stepIndex + 1];
    if (!stepStr) {
      throw new Error(`Invalid URI format: ${trimmedTarget}. Missing step number after '/step/'`);
    }
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step < 1) {
      throw new Error(`Invalid step number in URI: ${stepStr}. Step numbers must be positive integers starting from 1`);
    }

    return step;
  }

  // If none of the formats match
  throw new Error(`Invalid target format: "${trimmedTarget}". Supported formats: "step/3", "memory/3", "3", "kairos://domain/type/task/step/3", or "kairos://path/step/3"`);
}

/**
 * Extract step number from target string (supports both "step/X" and "memory/X" formats)
 * @deprecated Use validateAndExtractStepFromTarget instead
 */
export function extractStepFromTarget(target: string): number | null {
  try {
    return validateAndExtractStepFromTarget(target);
  } catch {
    return null; // For backward compatibility, return null on error
  }
}

/**
 * Validate that the target step exists in the protocol
 */
export async function validateTargetExists(
  qdrantService: QdrantService,
  target: string,
  kbName: string
): Promise<boolean> {
  try {
    const { domain, task } = parseKbName(kbName);
    const targetStep = validateAndExtractStepFromTarget(target);

    // Use scroll to find the specific step
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'domain', match: { value: domain } },
        { key: 'task', match: { value: task } },
        { key: 'protocol.step', match: { value: targetStep } }
      ]
    });
    const result = await qdrantService.client.scroll(qdrantService.collectionName, {
      filter,
      limit: 1,
      with_payload: true,
      with_vector: false
    });

    return !!(result.points && result.points.length > 0);
  } catch (error) {
    logger.error(`Failed to validate target "${target}" for kbName "${kbName}"`, error);
    return false;
  }
}

/**
 * Generate operation candidates for medium confidence cases
 */
export function generateCandidates(): Array<{ uri: string; type: string; confidence: number }> {
  // This would generate alternative operation suggestions
  // For now, return basic candidates
  return [
    {
      uri: 'append',
      type: 'operation',
      confidence: 0.7
    },
    {
      uri: 'create',
      type: 'operation',
      confidence: 0.5
    }
  ];
}

/**
 * Log operation detection results for debugging and analytics
 */
export function logOperationDetection(result: any, kbName: string): void {
  logger.info(`Operation detection: ${result.operation} (${result.confidence}) - ${result.reasoning}`);

  if (result.confidence < 0.6) {
    logger.warn(`Low confidence operation detection: ${result.operation} (${result.confidence}) for kb_name "${kbName}"`);
  }
}

/**
 * Count steps in an existing protocol by checking for step URIs
 */
export function countProtocolSteps(memory: any): number {
  // This is a simplified implementation
  // In practice, we'd need to query for all steps with the same protocol ID
  // For now, return a placeholder - this would need proper protocol step counting
  return memory.protocol?.total || 0;
}