import { QdrantService } from '../qdrant/service.js';
import { OperationType, OperationDetectionResult } from './types.js';
import { generateMemoryUri, generateCandidates } from './utils.js';
import { findExistingProtocol, renumberProtocolSteps, getProtocolDetails, updateProtocolStepCount } from './protocol.js';
import { handleExplicitOperation } from './handlers.js';

// Re-export types for backward compatibility
export type { OperationType, OperationDetectionResult };

/**
 * Smart operation detection service that resolves create vs append automatically
 * Based on appendix recommendations with graduated confidence thresholds
 */
export class OperationDetector {
  constructor(private qdrantService: QdrantService) {}

  /**
   * Detect the appropriate operation for storing content
   * Uses graduated confidence thresholds as specified in enhanced approach
   */
  async detectOperation(kbName: string, input: string | string[], target?: string): Promise<OperationDetectionResult> {
    const hasTarget = !!target;

    // Case 1: Explicit target provided - determine operation type
    if (hasTarget) {
      return this.detectWithTarget(target);
    }

    // Case 2: No target - auto-detect create vs append
    const existingProtocol = await findExistingProtocol(this.qdrantService, kbName);

    if (!existingProtocol) {
      // No existing protocol - CREATE operation with high confidence
      return {
        operation: 'create',
        confidence: 0.95,
        reasoning: 'No existing protocol found for kb_name; creating new protocol with high confidence',
        requiresExplicit: false
      };
    } else {
      // Existing protocol found - APPEND operation with confidence based on protocol maturity
      const nextMemoryNumber = existingProtocol.totalSteps + 1;
      const targetUri = generateMemoryUri(kbName, nextMemoryNumber);

      // Confidence increases with protocol maturity (more steps = more confident)
      const baseConfidence = 0.9;
      const maturityBonus = Math.min(0.05, existingProtocol.totalSteps * 0.01); // Max 0.05 bonus
      const confidence = Math.min(0.95, baseConfidence + maturityBonus);

      return {
        operation: 'append',
        confidence,
        reasoning: `Existing protocol found with ${existingProtocol.totalSteps} memories (${existingProtocol.totalSteps >= 3 ? 'mature' : 'developing'}); appending as memory ${nextMemoryNumber}`,
        target: targetUri,
        requiresExplicit: false
      };
    }
  }

  /**
   * Detect operation when explicit target is provided
   */
  private async detectWithTarget(target: string): Promise<OperationDetectionResult> {
    // For now, assume replace operation when target is explicit
    // Future: could enhance to detect insert-before/insert-after based on target position
    return {
      operation: 'replace',
      confidence: 0.8,
      reasoning: `Explicit target provided: ${target}`,
      target,
      requiresExplicit: false
    };
  }

  /**
   * Enhanced operation resolution with confidence reporting
   */
  async resolveOperationWithConfidence(
    kbName: string,
    input: string | string[],
    explicitOperation?: string,
    target?: string
  ): Promise<OperationDetectionResult> {
    // Case 1: Explicit operation provided
    if (explicitOperation) {
      return await handleExplicitOperation(this.qdrantService, explicitOperation, target, input, kbName);
    }

    // Case 2: No explicit operation - auto-detect create vs append
    const result = await this.detectOperation(kbName, input, target);

    // Apply graduated confidence thresholds per appendix recommendations
    if (result.confidence >= 0.6) {
      result.requiresExplicit = false;
      return result;
    } else if (result.confidence >= 0.3) {
      // Medium confidence - return candidates and require confirmation
      result.requiresExplicit = true;
      result.candidates = generateCandidates();
      result.reasoning += ' (medium confidence - confirmation recommended)';
      return result;
    } else {
      // Low confidence - fail with explainable reasons
      result.requiresExplicit = true;
      result.reasoning += ' (low confidence - explicit operation required)';
      return result;
    }
  }

  /**
   * Renumber protocol memories to maintain sequential integrity
   * This method handles memory renumbering for insert operations
   */
  async renumberProtocolSteps(
    domain: string,
    task: string,
    insertMemory: number,
    memoriesToShift: number = 0
  ): Promise<void> {
    return renumberProtocolSteps(this.qdrantService, domain, task, insertMemory, memoriesToShift);
  }

  /**
   * Get detailed protocol information including all memories
   */
  async getProtocolDetails(domain: string, task: string): Promise<{
    totalSteps: number;
    steps: Array<{ step: number; uuid: string; content: string }>;
  }> {
    return getProtocolDetails(this.qdrantService, domain, task);
  }

  /**
   * Update protocol memory count after modifications
   */
  private async updateProtocolStepCount(domain: string, task: string, newTotal: number): Promise<void> {
    return updateProtocolStepCount(this.qdrantService, domain, task, newTotal);
  }
}
