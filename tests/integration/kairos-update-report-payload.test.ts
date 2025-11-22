import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('kairos_update using report payload', () => {
    let mcpConnection;

    beforeAll(async () => {
        mcpConnection = await createMcpConnection();
    }, 60000);

    afterAll(async () => {
        if (mcpConnection) await mcpConnection.close();
    });

    test('should update memory in KB using payload from reports/kairos_update_payload.json', async () => {
        // 1) store a memory so the UUID exists
        const initial = `# Kairos Update Test - initial\n\nInitial content`;
        const storeResult = await mcpConnection.client.callTool({
            name: 'kairos_mint',
            arguments: { markdown_doc: JSON.stringify(initial), llm_model_id: 'test-update-payload-model' }
        });
        const storeResp = JSON.parse(storeResult.content[0].text);
        let memUri;
        // Handle duplicate chain or newly stored
        if (storeResp.status === 'stored') {
            memUri = storeResp.items[0].uri;
        } else if (storeResp.error === 'DUPLICATE_CHAIN' && Array.isArray(storeResp.items) && storeResp.items.length > 0) {
            memUri = storeResp.items[0].uri;
        } else {
            withRawOnFail(storeResp, () => {
                expect(storeResp.status === 'stored' || (storeResp.error === 'DUPLICATE_CHAIN' && Array.isArray(storeResp.items))).toBeTruthy();
            }, 'kairos_mint raw error');
            memUri = storeResp.items?.[0]?.uri;
        }

        // 2) load payload file and replace URI with our created one
        const payload = {
            "uri": "kairos://mem/9c4c3a95-7c0a-4069-83df-8b0f7779b0b5",
            "markdown_doc": "<!-- KAIROS:BODY-START -->\nProtocol Name: ai-coding-rules-orchestrator\nVersion: 1.0\nTotal Steps: 12\nEnforcement: sequential (follow in order)\nSkip Allowed: false (all steps mandatory unless explicitly escalated)\n\nPurpose: Rules for orchestrator agents that coordinate coders, testers, architects, and debuggers to deliver verifiable, reliable software.\n\nScope: Orchestrator responsibilities include breaking down tasks, prompting specialists, verifying artifacts, running builds/tests, handling retries and switching models when needed.\n\n---\nKiloCode Orchestrator Runtime (event loop)\nYou run inside **Kilo Code Orchestrator mode**. This document is only read by you, the orchestrator agent; do not explain these rules back to the user, simply apply them. Treat every user request as a high-level Goal that must be achieved end-to-end.\n\n---\n## Proof of Work Requirements for Coding Tasks\n\nEvery completed coding task MUST provide verifiable proof of work consisting of:\n\n### 1. Git Commit Hash with Test Reference\n- Include the full git commit hash (e.g., `abc123def456`)\n- The commit message MUST reference that tests are passing\n- Example: `git commit -m 'feat: implement feature X - all tests passing (see log)']`\n\n### 2. Test Log Output\n- Provide complete log output from running test command (e.g., `npm test`, `pytest`, etc.)\n- The log MUST show all tests passing with no failures\n- Include timestamp and test count summary\n- Example output:\n```\n✓ 25 tests passed (2.3s)\nPASS tests/integration/some.test.ts\nPASS tests/unit/another.test.ts\n```\n\n### 3. Measurable Proof Format\nPresent both items together in this exact format:\n```\nCommit: <hash>\nBranch: <branch-name>\nTest Command: <command used>\nTest Results:\n<full log output showing all tests passing>\n```\n\n**MANDATORY**: This proof of work is required for ALL coding work completion.\n\n<!-- KAIROS:BODY-END -->"
        };
        payload.uri = memUri;

        // 3) call kairos_update with markdown_doc
        const upd = await mcpConnection.client.callTool({
            name: 'kairos_update',
            arguments: { uris: [payload.uri], markdown_doc: [payload.markdown_doc] }
        });

        const updResp = JSON.parse(upd.content[0].text);
        withRawOnFail(updResp, () => {
            // Bulk results[] expected
            expect(Array.isArray(updResp.results)).toBe(true);
            expect(updResp.results[0].status).toBe('updated');
            expect(updResp.results[0].uri).toBe(memUri);
        }, 'kairos_update raw');

        // 4) read resource to verify updated content contains a known phrase from payload
        const read1 = await mcpConnection.client.readResource({ uri: memUri });
        const text1 = read1.contents?.[0]?.text || '';
        expect(text1).toContain('<!-- KAIROS:BODY-START -->');
        expect(text1).toContain('Protocol Name: ai-coding-rules-orchestrator');
    }, 40000);
});
