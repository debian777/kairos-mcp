import { QdrantConnection } from './connection.js';

/**
 * Protocol helpers: findProtocolSteps, findProtocolStep
 */

export async function findProtocolSteps(conn: QdrantConnection, protocolId: string) {
  return conn.executeWithReconnect(async () => {
    const result = await conn.client.scroll(conn.collectionName, {
      filter: { must: [{ key: 'protocol_id', match: { value: protocolId } }] },
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
    const result = await conn.client.scroll(conn.collectionName, {
      filter: {
        must: [
          { key: 'domain', match: { value: domain } },
          { key: 'type', match: { value: type } },
          { key: 'task', match: { value: task } },
          { key: 'protocol.step', match: { value: step } }
        ]
      },
      limit: 1,
      with_payload: true,
      with_vector: false
    });
    if (!result.points || result.points.length === 0) return null;
    const point = result.points[0]!;
    return { uuid: point.id.toString(), payload: point.payload };
  });
}