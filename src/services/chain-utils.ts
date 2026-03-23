import { qdrantService as globalQdrantService } from './qdrant/index.js';
import type { Memory } from '../types/memory.js';
import { getAdapterInfo, getAdapterId } from './memory/memory-accessors.js';
import { buildAdapterUri } from '../tools/kairos-uri.js';

export interface ResolvedChainStep {
    uuid: string;
    label?: string;
    step?: number;
    count?: number;
}

async function getChainPoints(chainId: string, qdrantService?: any): Promise<any[]> {
    const svc = qdrantService || globalQdrantService;
    if (!svc || typeof (svc as any).getChainMemories !== 'function') return [];
    try {
        return await (svc as any).getChainMemories(chainId);
    } catch {
        return [];
    }
}

export async function resolveFirstStep(
    memory: Memory,
    qdrantService?: any
): Promise<{ uri: string; label: string } | undefined> {
    const adapter = getAdapterInfo(memory);
    const adapterId = getAdapterId(memory);
    const adapterUri = buildAdapterUri(adapterId);
    if (!adapter || adapter.layer_index === 1) {
        return { uri: adapterUri, label: String(memory.label || 'Memory') };
    }

    const points: any[] = await getChainPoints(adapter.id, qdrantService);
    if (!Array.isArray(points) || points.length === 0) return { uri: adapterUri, label: String(memory.label || 'Memory') };

    const head = points
        .map(pt => ({
            uuid: (pt as any)?.uuid || (pt as any)?.id?.toString?.() || '',
            label: (pt as any)?.payload?.label || 'Memory',
            step: (pt as any)?.payload?.chain?.step_index ?? Number.MAX_SAFE_INTEGER
        }))
        .sort((a, b) => (a.step ?? Number.MAX_SAFE_INTEGER) - (b.step ?? Number.MAX_SAFE_INTEGER))[0];

    if (head && head.uuid) return { uri: adapterUri, label: String(head.label || memory.label || 'Memory') };
    return { uri: adapterUri, label: String(memory.label || 'Memory') };
}

export async function resolveChainFirstStep(
    memory: Memory,
    qdrantService?: any
): Promise<ResolvedChainStep | undefined> {
    const adapter = getAdapterInfo(memory);
    if (!adapter) return undefined;
    const points: any[] = await getChainPoints(adapter.id, qdrantService);
    if (!Array.isArray(points) || points.length === 0) return undefined;
    const first = points
        .map(pt => ({
            uuid: (pt as any)?.uuid || (pt as any)?.id?.toString?.() || '',
            label: (pt as any)?.payload?.label || undefined,
            step: (pt as any)?.payload?.chain?.step_index ?? Number.MAX_SAFE_INTEGER
        }))
        .find(p => p.step === 1);
    if (first && first.uuid) {
        return { uuid: first.uuid, label: first.label, step: first.step, count: adapter.layer_count };
    }
    return undefined;
}

export async function resolveChainNextStep(
    memory: Memory,
    qdrantService?: any
): Promise<ResolvedChainStep | undefined> {
    const adapter = getAdapterInfo(memory);
    if (!adapter) return undefined;
    const { id: chainId, layer_index: idx, layer_count: count } = adapter;
    if (idx >= count) return undefined;
    const points: any[] = await getChainPoints(chainId, qdrantService);
    if (!Array.isArray(points) || points.length === 0) return undefined;
    const next = points
        .map(pt => ({
            uuid: (pt as any)?.uuid || (pt as any)?.id?.toString?.() || '',
            label: (pt as any)?.payload?.label || undefined,
            step: (pt as any)?.payload?.chain?.step_index ?? Number.MAX_SAFE_INTEGER
        }))
        .find(p => p.step === idx + 1);
    if (next && next.uuid) return { uuid: next.uuid, label: next.label, step: next.step, count };
    return undefined;
}

export async function resolveChainPreviousStep(
    memory: Memory,
    qdrantService?: any
): Promise<ResolvedChainStep | undefined> {
    const adapter = getAdapterInfo(memory);
    if (!adapter) return undefined;
    const { id: chainId, layer_index: idx, layer_count: count } = adapter;
    if (idx <= 1) return undefined;
    const points: any[] = await getChainPoints(chainId, qdrantService);
    if (!Array.isArray(points) || points.length === 0) return undefined;
    const prev = points
        .map(pt => ({
            uuid: (pt as any)?.uuid || (pt as any)?.id?.toString?.() || '',
            label: (pt as any)?.payload?.label || undefined,
            step: (pt as any)?.payload?.chain?.step_index ?? Number.MAX_SAFE_INTEGER
        }))
        .find(p => p.step === idx - 1);
    if (prev && prev.uuid) return { uuid: prev.uuid, label: prev.label, step: prev.step, count };
    return undefined;
}
