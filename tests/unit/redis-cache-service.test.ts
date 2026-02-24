import { jest } from '@jest/globals';

// Mock the Redis client before importing the service
const mockSubscriber = {
  on: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn().mockReturnValue(mockSubscriber),
  multi: jest.fn(),
};

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn().mockReturnValue(mockRedis),
  },
}));

describe("RedisCacheService", () => {
  let cacheService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset the singleton instance and re-import
    jest.resetModules();
    const { RedisCacheService } = require("../../src/services/redis-cache.js");

    // Create a new instance for testing (not using singleton)
    cacheService = new RedisCacheService();

    // Get the mock Redis instance from the mocked Redis.fromEnv
    mockRedis = require("@upstash/redis").Redis.fromEnv.mock.results[0]?.value;
  });

  describe("Cache Hit/Miss Logic", () => {
    const testQuery = "test query";
    const testLimit = 10;
    const testResult = {
      memories: [
        {
          memory_uuid: "test-uuid",
          label: "Test Memory",
          tags: ["test"],
          text: "Test content",
          previous_memory_uuid: null,
          next_memory_uuid: null,
          llm_model_id: "test-model",
          created_at: new Date().toISOString(),
        },
      ],
      scores: [0.8],
    };

    const prefix = process.env['KAIROS_REDIS_PREFIX'] || 'kb:';
    const collapseMode = (process.env['KAIROS_ENABLE_GROUP_COLLAPSE'] === 'false' || process.env['KAIROS_ENABLE_GROUP_COLLAPSE'] === '0') ? 'natural' : 'collapsed';
    const expectedKey = (q, limit, collapse = (collapseMode === 'collapsed')) => `${prefix}search:${collapse ? 'collapsed' : 'natural'}:${q}:${limit}`;

    test("should return cached result on cache hit", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(testResult));

      const result = await cacheService.getSearchResult(testQuery, testLimit);

      expect(result).toEqual(testResult);
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, testLimit));
    });

    test("should return null on cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.getSearchResult(testQuery, testLimit);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey(testQuery, testLimit));
    });

    test("should handle Redis errors gracefully on get", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.getSearchResult(testQuery, testLimit);

      expect(result).toBeNull();
    });

    test("should cache search result with TTL", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      await cacheService.setSearchResult(testQuery, testLimit, testResult);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expectedKey(testQuery, testLimit),
        300, // 5 minutes TTL
        JSON.stringify(testResult)
      );
    });

    test("should handle Redis errors gracefully on set", async () => {
      mockRedis.setex.mockRejectedValue(new Error("Redis connection failed"));

      // Should not throw
      await expect(cacheService.setSearchResult(testQuery, testLimit, testResult)).resolves.not.toThrow();
    });
  });

  describe("Cache Invalidation", () => {
    test("should invalidate all search cache entries", async () => {
      const mockKeys = ["kb:search:query1:5", "kb:search:query2:10"];
      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.del.mockResolvedValue(2);

      await cacheService.invalidateSearchCache();

      expect(mockRedis.keys).toHaveBeenCalledWith("kb:search:*");
      expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys);
    });

    test("should handle empty cache gracefully", async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.invalidateSearchCache();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    test("should handle Redis errors during invalidation", async () => {
      mockRedis.keys.mockRejectedValue(new Error("Redis connection failed"));

      // Should not throw
      await expect(cacheService.invalidateSearchCache()).resolves.not.toThrow();
    });
  });

  describe("Pub/Sub Invalidation", () => {
    test("should publish invalidation event", async () => {
      mockRedis.publish.mockResolvedValue(1);

      await cacheService.publishInvalidation("search");

      expect(mockRedis.publish).toHaveBeenCalledWith(
        "kb:cache:invalidation",
        JSON.stringify({ type: "search", timestamp: expect.any(Number) })
      );
    });

    test("should handle Redis errors during publish", async () => {
      mockRedis.publish.mockRejectedValue(new Error("Redis connection failed"));

      // Should not throw
      await expect(cacheService.publishInvalidation("search")).resolves.not.toThrow();
    });
  });

  describe("Atomic Operations", () => {
    test("should perform atomic cache invalidation after update", async () => {
      const mockTx = {
        publish: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedis.multi.mockReturnValue(mockTx);

      await cacheService.invalidateAfterUpdate();

      expect(mockRedis.multi).toHaveBeenCalled();
      expect(mockTx.publish).toHaveBeenCalledWith(
        "kb:cache:invalidation",
        JSON.stringify({ type: "search", timestamp: expect.any(Number) })
      );
      expect(mockTx.exec).toHaveBeenCalled();
    });
  });

  describe("Error Handling and Resilience", () => {
    test("should handle malformed cached data gracefully", async () => {
      mockRedis.get.mockResolvedValue("invalid json");

      const result = await cacheService.getSearchResult("test", 5);

      expect(result).toBeNull();
    });

    test("should handle empty query strings", async () => {
      const result = await cacheService.getSearchResult("", 5);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith("kb:search::5");
    });

    test("should handle special characters in query", async () => {
      const specialQuery = "test & query < > \" '";
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.getSearchResult(specialQuery, 5);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(`kb:search:${specialQuery}:5`);
    });

    test("should handle very long queries", async () => {
      const longQuery = "a".repeat(1000);
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.getSearchResult(longQuery, 5);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(`kb:search:${longQuery}:5`);
    });
  });

  describe("TTL Behavior", () => {
    test("should use correct TTL for search results", async () => {
      const testResult = { memories: [], scores: [] };
      mockRedis.setex.mockResolvedValue("OK");

      await cacheService.setSearchResult("test", 5, testResult);

      // Verify TTL is 300 seconds (5 minutes)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        300,
        expect.any(String)
      );
    });
  });
});
