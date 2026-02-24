import { QdrantConnection } from './connection.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';

/**
 * Protocol helpers: findProtocolSteps, findProtocolStep
 */

export async function findProtocolSteps(conn: QdrantConnection, protocolId: string) {
  return conn.executeWithReconnect(async () => {
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, { must: [{ key: 'protocol_id', match: { value: protocolId } }] });
    const result = await conn.client.scroll(conn.collectionName, {
      filter,
      limit: 100,
      with_payload: true,
      with_vector: false
    });
    if (!result.points) return [];
    return result.points
      .map((point: any) => ({
        uuid: point.id.toString(),
        protocol: (point.payload as any).protocol,
        payload: point.payload
      }))
      .filter((item: any) => item.protocol);
  });
}

export async function findProtocolStep(conn: QdrantConnection, domain: string, type: string, task: string, step: number) {
  return conn.executeWithReconnect(async () => {
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'domain', match: { value: domain } },
        { key: 'type', match: { value: type } },
        { key: 'task', match: { value: task } },
        { key: 'protocol.step', match: { value: step } }
      ]
    });
    const result = await conn.client.scroll(conn.collectionName, {
      filter,
      limit: 1,
      with_payload: true,
      with_vector: false
    });
    if (!result.points || result.points.length === 0) return null;
    const point = result.points[0]!;
    return { uuid: point.id.toString(), payload: point.payload };
  });
}