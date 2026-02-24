import { registerSearchTool } from '../../src/tools/kairos_search.js';
// Remove TypeScript type imports for test runtime parsing

describe('kb_search collapse flag behavior (unit)', () => {
    const testQuery = 'collapse-test';

    /* Helper that constructs a fake MemoryQdrantStore returning a chain of 3 memories */
    const makeMockMemoryStore = (chainId = 'chain-abc') => {
        const memories = [
            { memory_uuid: 'm1', memory_chain_id: chainId, chain_step_index: 1, label: 'A', tags: [], text: '', llm_model_id: 'x', created_at: new Date().toISOString() },
            { memory_uuid: 'm2', memory_chain_id: chainId, chain_step_index: 2, label: 'B', tags: [], text: '', llm_model_id: 'x', created_at: new Date().toISOString() },
            { memory_uuid: 'm3', memory_chain_id: chainId, chain_step_index: 3, label: 'C', tags: [], text: '', llm_model_id: 'x', created_at: new Date().toISOString() }
        ];
        const store = {
            searchMemories: async () => ({ memories, scores: [0.9, 0.8, 0.7] })
        };
        return store;
    };

    const makeFakeServer = () => {
        const toolRegistry = {};
        return {
            registerTool(name, def, handler) {
                toolRegistry[name] = { def, handler };
            },
            toolRegistry,
        };
    };

    test('collapsed when KAIROS_ENABLE_GROUP_COLLAPSE=true', async () => {
        process.env['KAIROS_ENABLE_GROUP_COLLAPSE'] = 'true';
        const memStore = makeMockMemoryStore();
        const server = makeFakeServer();
        registerSearchTool(server, memStore);
        const handler = server.toolRegistry['kairos_search'].handler;
        const result = await handler({ query: testQuery, limit: 5 });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.must_obey).toBe(true);
        expect(Array.isArray(parsed.choices)).toBe(true);
        expect(parsed.choices.length).toBeGreaterThanOrEqual(1);
    });

    test('uncollapsed when KAIROS_ENABLE_GROUP_COLLAPSE=false', async () => {
        process.env['KAIROS_ENABLE_GROUP_COLLAPSE'] = 'false';
        const memStore = makeMockMemoryStore();
        const server = makeFakeServer();
        registerSearchTool(server, memStore);
        const handler = server.toolRegistry['kairos_search'].handler;
        const result = await handler({ query: testQuery, limit: 5 });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.must_obey).toBe(true);
        expect(Array.isArray(parsed.choices)).toBe(true);
        expect(parsed.choices.length).toBeGreaterThanOrEqual(1);
    });
});
