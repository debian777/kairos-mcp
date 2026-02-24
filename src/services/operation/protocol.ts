import { QdrantService } from '../qdrant/service.js';
import { logger } from '../../utils/logger.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { parseKbName, generateProtocolUri } from './utils.js';

/**
 * Enhanced confidence reporting with graduated thresholds
 */
export async function findExistingProtocol(
  qdrantService: QdrantService,
  kbName: string
): Promise<{ totalSteps: number; uri: string } | null> {
  try {
    // Parse kbName to generate expected domain/task structure
    const { domain, task } = parseKbName(kbName);

    // Use scroll to find existing protocol items with matching domain/task
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'domain', match: { value: domain } },
        { key: 'task', match: { value: task } }
      ]
    });
    const result = await qdrantService.client.scroll(qdrantService.collectionName, {
      filter,
      limit: 100, // Get enough to count protocol steps
      with_payload: true,
      with_vector: false
    });

    if (!result.points || result.points.length === 0) {
      return null;
    }

    // Count protocol steps
    let maxStep = 0;
    for (const point of result.points) {
      const payload = point.payload as any;
      if (payload.protocol && payload.protocol.step) {
        maxStep = Math.max(maxStep, payload.protocol.step);
      }
    }

    if (maxStep > 0) {
      return {
        totalSteps: maxStep,
        uri: generateProtocolUri(domain, task)
      };
    }

    return null;
  } catch (error) {
    logger.error(`Failed to detect existing protocol for kb_name "${kbName}"`, error);
    return null;
  }
}

/**
 * Renumber protocol memories to maintain sequential integrity
 * This method handles memory renumbering for insert operations
 */
export async function renumberProtocolSteps(
  qdrantService: QdrantService,
  domain: string,
  task: string,
  insertMemory: number,
  memoriesToShift: number = 0
): Promise<void> {
  try {
    // Find all memories in the protocol that need to be renumbered
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'domain', match: { value: domain } },
        { key: 'task', match: { value: task } },
        { key: 'protocol.step', range: { gte: insertMemory } }
      ]
    });
    const result = await qdrantService.client.scroll(qdrantService.collectionName, {
      filter,
      limit: 100,
      with_payload: true,
      with_vector: false
    });

    if (!result.points) {
      return;
    }

    const protocolMemories = result.points
      .filter((point: any) => {
        const payload = point.payload as any;
        return payload.protocol?.step !== undefined && payload.protocol.step >= insertMemory;
      })
      .sort((a: any, b: any) => {
        const payloadA = a.payload as any;
        const payloadB = b.payload as any;
        return (payloadA.protocol?.step || 0) - (payloadB.protocol?.step || 0);
      });

    // Update memory numbers for all affected memories
    for (const point of protocolMemories) {
      const payload = point.payload as any;
      const oldMemory = payload.protocol.step;
      const newMemory = oldMemory + memoriesToShift;

      // Update the memory number
      payload.protocol.step = newMemory;

      // Update in database
      await qdrantService.updateMemory(point.id.toString(), {
        protocol: payload.protocol
      });

      logger.info(`Renumbered memory ${oldMemory} to ${newMemory} in protocol ${domain}/${task}`);
    }

    logger.info(`Successfully renumbered ${protocolMemories.length} memories in protocol ${domain}/${task}`);
  } catch (error) {
    logger.error(`Failed to renumber protocol memories for ${domain}/${task}`, error);
    throw error;
  }
}

/**
 * Get detailed protocol information including all memories
 */
export async function getProtocolDetails(
  qdrantService: QdrantService,
  domain: string,
  task: string
): Promise<{
  totalSteps: number;
  steps: Array<{ step: number; uuid: string; content: string }>;
}> {
  try {
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'domain', match: { value: domain } },
        { key: 'task', match: { value: task } }
      ]
    });
    const result = await qdrantService.client.scroll(qdrantService.collectionName, {
      filter,
      limit: 100,
      with_payload: true,
      with_vector: false
    });

    if (!result.points) {
      return { totalSteps: 0, steps: [] };
    }

    const protocolMemories = result.points
      .filter((point: any) => {
        const payload = point.payload as any;
        return payload.protocol?.step !== undefined;
      })
      .sort((a: any, b: any) => {
        const payloadA = a.payload as any;
        const payloadB = b.payload as any;
        return (payloadA.protocol?.step || 0) - (payloadB.protocol?.step || 0);
      });

    return {
      totalSteps: protocolMemories.length,
      steps: protocolMemories.map((point: any) => {
        const payload = point.payload as any;
        return {
          step: payload.protocol.step,
          uuid: point.id.toString(),
          content: payload.description || payload.description_short || ''
        };
      })
    };
  } catch (error) {
    logger.error(`Failed to get protocol details for ${domain}/${task}`, error);
    throw error;
  }
}

/**
 * Update protocol memory count after modifications
 */
export async function updateProtocolStepCount(
  qdrantService: QdrantService,
  domain: string,
  task: string,
  newTotal: number
): Promise<void> {
  try {
    // Find the protocol root or first memory to update
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'domain', match: { value: domain } },
        { key: 'task', match: { value: task } },
        { key: 'protocol.step', match: { value: 1 } }
      ]
    });
    const result = await qdrantService.client.scroll(qdrantService.collectionName, {
      filter,
      limit: 10,
      with_payload: true,
      with_vector: false
    });

    if (!result.points || result.points.length === 0) {
      logger.warn(`No step 1 found for protocol ${domain}/${task} to update total count`);
      return;
    }

    const firstStep = result.points[0];
    if (!firstStep) {
      logger.warn(`No step 1 found for protocol ${domain}/${task} to update total count`);
      return;
    }

    const payload = firstStep.payload as any;

    if (payload.protocol) {
      // Update the total memories count
      const updatedProtocol = { ...payload.protocol, total: newTotal };

      await qdrantService.updateMemory(firstStep.id.toString(), {
        protocol: updatedProtocol
      });

      logger.info(`Updated total memories to ${newTotal} for protocol ${domain}/${task}`);
    }
  } catch (error) {
    logger.error(`Failed to update protocol memory count for ${domain}/${task}`, error);
  }
}