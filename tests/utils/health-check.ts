/**
 * Health check utility for MCP server readiness
 * Polls the health endpoint until server is ready or timeout occurs
 */

// JSDoc typedefs replacing TypeScript interfaces
/**
 * @typedef {Object} HealthCheckOptions
 * @property {string} [url]
 * @property {number} [timeoutMs]
 * @property {number} [intervalMs]
 * @property {number} [maxRetries]
 */

/**
 * @typedef {Object} HealthResponse
 * @property {'healthy'|'degraded'} status
 * @property {string} service
 * @property {string} version
 * @property {string} transport
 * @property {Object} dependencies
 * @property {'healthy'|'unhealthy'} dependencies.qdrant
 * @property {'healthy'|'unhealthy'} dependencies.redis
 * @property {'healthy'|'unhealthy'} dependencies.tei
 */

/**
 * Waits for MCP server to be ready by polling health endpoint
 * @param options Configuration options for health check
 * @returns Promise that resolves when server is healthy, rejects on timeout
 */
export async function waitForHealthCheck(options = {}) {
  const {
    url = 'http://localhost:3300/health',
    timeoutMs = 30000, // 30 seconds
    intervalMs = 1000, // 1 second
    maxRetries = 30
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  console.log(`Waiting for MCP server health check at ${url} (timeout: ${timeoutMs}ms)`);

  while (attempts < maxRetries) {
    const elapsed = Date.now() - startTime;

    if (elapsed > timeoutMs) {
      throw new Error(`Health check timeout after ${elapsed}ms (${attempts} attempts)`);
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const healthData = await response.json();

        if (healthData.status === 'healthy') {
          console.log(`✓ MCP server ready after ${elapsed}ms (${attempts + 1} attempts)`);
          return healthData;
        } else {
          console.log(`⚠ MCP server degraded (attempt ${attempts + 1}/${maxRetries}): ${JSON.stringify(healthData)}`);
        }
      } else {
        console.log(`⚠ Health check failed with status ${response.status} (attempt ${attempts + 1}/${maxRetries})`);
      }
    } catch {
      console.log(`⚠ Health check error (attempt ${attempts + 1}/${maxRetries})`);
    }

    attempts++;
    if (attempts < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Health check failed after ${maxRetries} attempts (${Date.now() - startTime}ms)`);
}
