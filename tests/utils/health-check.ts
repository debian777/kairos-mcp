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
 * @property {'healthy'|'unhealthy'} status
 * @property {string} service
 * @property {string} version
 * @property {string} transport
 * @property {Object} dependencies
 * @property {'healthy'|'unhealthy'} dependencies.qdrant
 * @property {'healthy'|'unhealthy'|'disabled'} dependencies.redis
 * @property {'healthy'|'unhealthy'|'disabled'} dependencies.embedding
 */

/**
 * Waits for MCP server to be ready by polling health endpoint
 * @param options Configuration options for health check
 * @returns Promise that resolves when server is healthy, rejects on timeout
 */
const HEALTH_CHECK_CACHE_KEY = '__KAIROS_TEST_HEALTH_CHECK_CACHE__';

export async function waitForHealthCheck(options = {}) {
  const {
    url = `http://localhost:${process.env.PORT || '3300'}/health`,
    timeoutMs = 30000, // 30 seconds
    intervalMs = 1000, // 1 second
    maxRetries = 30
  } = options;

  const cache = (((globalThis) as any)[HEALTH_CHECK_CACHE_KEY] ??= new Map());
  const cached = cache.get(url);
  if (cached?.promise) {
    return cached.promise;
  }

  const startTime = Date.now();
  let attempts = 0;

  let waitingLogged = false;
  const logAfterMs = 2000;
  const waitingTimer = setTimeout(() => {
    waitingLogged = true;
    console.log(`Waiting for MCP server health check at ${url} (timeout: ${timeoutMs}ms)`);
  }, logAfterMs);

  const run = async () => {
    while (attempts < maxRetries) {
      const elapsed = Date.now() - startTime;

      if (elapsed > timeoutMs) {
        if (!waitingLogged) {
          console.log(`Waiting for MCP server health check at ${url} (timeout: ${timeoutMs}ms)`);
        }
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
            clearTimeout(waitingTimer);
            if (waitingLogged) {
              console.log(`✓ MCP server ready after ${elapsed}ms (${attempts + 1} attempts)`);
            }
            return healthData;
          } else {
            if (!waitingLogged) {
              clearTimeout(waitingTimer);
              waitingLogged = true;
              console.log(`Waiting for MCP server health check at ${url} (timeout: ${timeoutMs}ms)`);
            }
            console.log(`⚠ MCP server degraded (attempt ${attempts + 1}/${maxRetries}): ${JSON.stringify(healthData)}`);
          }
        } else {
          if (!waitingLogged) {
            clearTimeout(waitingTimer);
            waitingLogged = true;
            console.log(`Waiting for MCP server health check at ${url} (timeout: ${timeoutMs}ms)`);
          }
          console.log(`⚠ Health check failed with status ${response.status} (attempt ${attempts + 1}/${maxRetries})`);
        }
      } catch {
        if (!waitingLogged) {
          clearTimeout(waitingTimer);
          waitingLogged = true;
          console.log(`Waiting for MCP server health check at ${url} (timeout: ${timeoutMs}ms)`);
        }
        console.log(`⚠ Health check error (attempt ${attempts + 1}/${maxRetries})`);
      }

      attempts++;
      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    if (!waitingLogged) {
      clearTimeout(waitingTimer);
      waitingLogged = true;
      console.log(`Waiting for MCP server health check at ${url} (timeout: ${timeoutMs}ms)`);
    }
    throw new Error(`Health check failed after ${maxRetries} attempts (${Date.now() - startTime}ms)`);
  };

  const promise = run().finally(() => clearTimeout(waitingTimer));
  cache.set(url, { promise });
  promise.catch(() => {
    const current = cache.get(url);
    if (current?.promise === promise) {
      cache.delete(url);
    }
  });
  return promise;
}
