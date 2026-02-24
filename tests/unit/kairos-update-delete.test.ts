import { jest } from '@jest/globals';
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { Redis } from "@upstash/redis";

// Mock Redis for testing
jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(),
  },
}));

describe("KB Update and Delete Tools", () => {
  let mcpConnection;
  let mockRedis;

  beforeAll(async () => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      multi: jest.fn(),
    };

    (Redis.fromEnv).mockReturnValue(mockRedis);

    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  beforeAll(async () => {
    // Store test document for update/delete scenarios
    const result = await mcpConnection.client.callTool({
      name: 'kb_store',
      arguments: {
        markdown_doc: `# Test Memory for Update/Delete

This is a test memory that will be updated and deleted during testing.`,
        llm_model_id: 'test-update-delete-model'
      }
    });

    expect(result).toBeDefined();
    expect(result.isError).not.toBe(true);
  }, 60000);

  describe("KB Update Tool", () => {
    test("should update memory and invalidate cache", async () => {
      // First, search to get a memory URI
      const searchResult = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: { query: "test memory", limit: 1 }
      });

      const searchResponse = JSON.parse(searchResult.content[0].text);
      expect(searchResponse.documents.length).toBeGreaterThan(0);

      const memoryUri = searchResponse.documents[0].uri;

      // Update the memory (bulk API: uris[])
      const updateResult = await mcpConnection.client.callTool({
        name: 'kb_update',
        arguments: {
          uris: [memoryUri],
          updates: {
            description_short: "Updated test memory"
          }
        }
      });
  
      const updateResponse = JSON.parse(updateResult.content[0].text);
      // Bulk results[] expected
      expect(Array.isArray(updateResponse.results)).toBe(true);
      expect(updateResponse.results[0].status).toBe('updated');
      expect(updateResponse.results[0].uri).toBe(memoryUri);
  
      // Verify cache invalidation was called
      expect(mockRedis.del).toHaveBeenCalledWith(`kb:dev:mem:${memoryUri.split('/').pop()}`);
    });

    test("should handle update errors gracefully", async () => {
      const invalidUri = "kairos://mem/invalid-uuid";
  
      const updateResult = await mcpConnection.client.callTool({
        name: 'kb_update',
        arguments: {
          uris: [invalidUri],
          updates: {
            description_short: "This should fail"
          }
        }
      });
  
      const updateResponse = JSON.parse(updateResult.content[0].text);
      expect(Array.isArray(updateResponse.results)).toBe(true);
      expect(updateResponse.results[0].status).toBe('error');
      expect(updateResponse.results[0].uri).toBe(invalidUri);
    });
  });

  describe("KB Delete Tool", () => {
    test("should delete memory and invalidate cache", async () => {
      // First, search to get a memory URI
      const searchResult = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: { query: "test memory", limit: 1 }
      });

      const searchResponse = JSON.parse(searchResult.content[0].text);
      expect(searchResponse.documents.length).toBeGreaterThan(0);

      const memoryUri = searchResponse.documents[0].uri;

      // Delete the memory
      const deleteResult = await mcpConnection.client.callTool({
        name: 'kb_delete',
        arguments: {
          uris: [memoryUri]
        }
      });

      const deleteResponse = JSON.parse(deleteResult.content[0].text);
      expect(deleteResponse.total_deleted).toBe(1);
      expect(deleteResponse.total_failed).toBe(0);
      expect(deleteResponse.results[0].status).toBe('deleted');
      expect(deleteResponse.results[0].uri).toBe(memoryUri);

      // Verify cache invalidation was called
      expect(mockRedis.del).toHaveBeenCalledWith(`kb:dev:mem:${memoryUri.split('/').pop()}`);
    });

    test("should handle delete errors gracefully", async () => {
      const invalidUri = "kairos://mem/invalid-uuid";

      const deleteResult = await mcpConnection.client.callTool({
        name: 'kb_delete',
        arguments: {
          uris: [invalidUri]
        }
      });

      const deleteResponse = JSON.parse(deleteResult.content[0].text);
      expect(deleteResponse.total_deleted).toBe(0);
      expect(deleteResponse.total_failed).toBe(1);
      expect(deleteResponse.results[0].status).toBe('error');
      expect(deleteResponse.results[0].uri).toBe(invalidUri);
    });
  });
});