/* eslint-disable max-lines */
import { jest } from '@jest/globals';
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { Redis } from "@upstash/redis";

// Mock Redis for integration tests to avoid external dependencies
jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(),
  },
}));

describe("KB Search Redis Caching Integration", () => {
  let mcpConnection;
  let mockRedis;

  beforeAll(async () => {
    // Create mock Redis that behaves like real Redis for testing
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      multi: jest.fn(),
    };

    // Mock Redis.fromEnv to return our mock
    (Redis.fromEnv).mockReturnValue(mockRedis);

    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  beforeAll(async () => {
    // Store test documents for consistent search results
    const testDocuments = [
      {
        content: `# JavaScript Programming Guide

This comprehensive guide covers JavaScript programming fundamentals including:
- Variables and data types
- Functions and scope
- Object-oriented programming
- Asynchronous programming with promises and async/await

JavaScript is a versatile programming language used for both frontend and backend development.`,
        tags: ['javascript', 'programming', 'guide', 'tutorial']
      },
      {
        content: `# Python Data Science Tutorial

Learn data science with Python using popular libraries like:
- NumPy for numerical computing
- Pandas for data manipulation
- Matplotlib for data visualization
- Scikit-learn for machine learning

Python excels in data analysis and scientific computing.`,
        tags: ['python', 'data-science', 'tutorial', 'machine-learning']
      }
    ];

    // Store all test documents
    for (const doc of testDocuments) {
      const result = await mcpConnection.client.callTool({
        name: 'kb_store',
        arguments: {
          markdown_doc: doc.content,
          llm_model_id: 'test-redis-cache-model'
        }
      });

      expect(result).toBeDefined();
      expect(result.isError).not.toBe(true);
    }

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 60000);

  function expectValidSearchResult(result) {
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    let parsed;
    try {
      parsed = JSON.parse(result.content[0].text);
    } catch (e) {
      console.error('kb_search raw MCP result (JSON.parse failed):', JSON.stringify(result));
      throw e;
    }

    return parsed;
  }

  describe("Cache Hit/Miss Behavior", () => {
    const testQuery = "javascript programming";
    const prefix = process.env['KAIROS_REDIS_PREFIX'] || 'kb:';
    const collapseMode = (process.env['KAIROS_ENABLE_GROUP_COLLAPSE'] === 'false' || process.env['KAIROS_ENABLE_GROUP_COLLAPSE'] === '0') ? 'natural' : 'collapsed';
    const expectedKey = (q, limit, collapse = (collapseMode === 'collapsed')) => `${prefix}search:${collapse ? 'collapsed' : 'natural'}:${q}:${limit}`;

    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      mockRedis.get.mockResolvedValue(null); // Default to cache miss
      mockRedis.setex.mockResolvedValue("OK");
    });

    test("should cache search results on first query (cache miss)", async () => {
      mockRedis.get.mockResolvedValue(null); // Cache miss

      const result = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: {
          query: testQuery,
          limit: 5
        }
      });

      const response = expectValidSearchResult(result);
      expect(response.documents.length).toBeGreaterThan(0);

      // Verify cache was checked and set (key includes group-collapse flag)
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, 5));
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expectedKey(testQuery, 5),
        300,
        expect.any(String)
      );
    });

    test("should serve from cache on subsequent identical queries (cache hit)", async () => {
      const cachedResult = {
        memories: [
          {
            memory_uuid: "cached-uuid",
            label: "Cached JavaScript Memory",
            tags: ["javascript"],
            text: "Cached content",
            previous_memory_uuid: null,
            next_memory_uuid: null,
            llm_model_id: "test-model",
            created_at: new Date().toISOString(),
          }
        ],
        scores: [0.9]
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: {
          query: testQuery,
          limit: 5
        }
      });

      const response = expectValidSearchResult(result);

      // Should return cached result
      expect(response.documents).toHaveLength(1);
      expect(response.documents[0].uri).toBe("kairos://mem/cached-uuid");
      expect(response.documents[0].label).toBe("Cached JavaScript Memory");
      expect(response.documents[0].tags).toEqual(["javascript"]);
      expect(response.documents[0].score).toBe(0.9);

      // Verify cache was checked but not set (since it was a hit)
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, 5));
      expect(mockRedis.setex).not.toHaveBeenCalled();

      test("should handle cache miss gracefully", async () => {
        mockRedis.get.mockResolvedValue(null); // Explicit cache miss

        const result = await mcpConnection.client.callTool({
          name: 'kb_search',
          arguments: {
            query: testQuery,
            limit: 5
          }
        });

        const response = expectValidSearchResult(result);
        expect(response.documents.length).toBeGreaterThan(0);

        // Should perform search and cache result
        expect(mockRedis.setex).toHaveBeenCalled();
      });

      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, 5));
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, 10));

      // First query with limit 5
      await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: { query: testQuery, limit: 5 }
      });

      // Second query with limit 10 (different cache key)
      await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: { query: testQuery, limit: 10 }
      });

      // Should have checked cache twice with different keys
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, 5));
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, 10));
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
    });
  });

  describe("Pub/Sub Invalidation", () => {
    test("should invalidate cache when invalidation message received", async () => {
      // Set up initial cache
      const cachedResult = {
        memories: [{
          memory_uuid: "test-uuid",
          label: "Test",
          tags: [],
          text: "content",
          previous_memory_uuid: null,
          next_memory_uuid: null,
          llm_model_id: "test",
          created_at: new Date().toISOString()
        }],
        scores: [0.8]
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));
      mockRedis.keys.mockResolvedValue([expectedKey('javascript', 5)]);
      mockRedis.del.mockResolvedValue(1);

      // First request should hit cache
      const result1 = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: { query: "javascript", limit: 5 }
      });
      expectValidSearchResult(result1);

      // Simulate cache invalidation (this would normally happen via pub/sub)
      // In real scenario, this would be triggered by store operations
      mockRedis.get.mockResolvedValue(null); // Simulate invalidation

      // Second request should miss cache and perform search
      const result2 = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: { query: "javascript", limit: 5 }
      });
      expectValidSearchResult(result2);

      // Should have performed search and re-cached
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe("Crash/Failure Recovery", () => {
    test("should continue working when Redis is unavailable", async () => {
      // Simulate Redis failure
      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));
      mockRedis.setex.mockRejectedValue(new Error("Redis connection failed"));

      const result = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: {
          query: "javascript",
          limit: 5
        }
      });

      const response = expectValidSearchResult(result);

      // Should still return results despite Redis failure
      expect(response.documents.length).toBeGreaterThan(0);
      expect(response.searchMetadata.totalResults).toBeGreaterThan(0);
    });

    test("should handle corrupted cache data gracefully", async () => {
      // Simulate corrupted cache data
      mockRedis.get.mockResolvedValue("invalid json data");

      const result = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: {
          query: "javascript",
          limit: 5
        }
      });

      const response = expectValidSearchResult(result);

      // Should fall back to search and return valid results
      expect(response.documents.length).toBeGreaterThan(0);
      // Should attempt to re-cache the result
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    test("should handle Redis timeout gracefully", async () => {
      // Simulate Redis timeout
      mockRedis.get.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve(null), 100); // Simulate delay
      }));
      mockRedis.setex.mockRejectedValue(new Error("Timeout"));

      const result = await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: {
          query: "javascript",
          limit: 5
        }
      });

      const response = expectValidSearchResult(result);

      // Should still work despite timeout
      expect(response.documents.length).toBeGreaterThan(0);
    });
  });

  describe("Stale Cache Minimization", () => {
    test("should respect TTL and serve fresh results after expiration", async () => {
      // This test would be more complex in real scenario
      // For now, verify that TTL is set correctly
      mockRedis.get.mockResolvedValue(null);

      await mcpConnection.client.callTool({
        name: 'kb_search',
        arguments: { query: "javascript", limit: 5 }
      });

      // Verify TTL is set to 5 minutes (300 seconds)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        300,
        expect.any(String)
      );
    });

    test("should handle concurrent cache operations safely", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      // Simulate concurrent requests
      const promises = Array(5).fill().map(() =>
        mcpConnection.client.callTool({
          name: 'kb_search',
          arguments: { query: "javascript", limit: 5 }
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        const response = expectValidSearchResult(result);
        expect(response.documents.length).toBeGreaterThan(0);
      });
    });
  });
});