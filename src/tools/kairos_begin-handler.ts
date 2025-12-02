import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { redisCacheService } from '../services/redis-cache.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { searchAndBuildCandidates } from './kairos_begin-search.js';
import { createResults } from './kairos_begin-helpers.js';
import {
  generateSinglePerfectMatchOutput,
  generateMultiplePerfectMatchesOutput,
  generatePartialMatchOutput,
  generateNoResultsOutput
} from './kairos_begin-output.js';

/**
 * Handles kairos_begin tool execution
 */
export async function handleBeginTool(
  toolName: string,
  memoryStore: MemoryQdrantStore,
  query: string,
  qdrantService?: QdrantService
): Promise<any> {
  const tenantId = getTenantId();
  const inputSize = JSON.stringify({ query }).length;
  mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
  
  const timer = mcpToolDuration.startTimer({ 
    tool: toolName,
    tenant_id: tenantId 
  });
  
  try {
    const normalizedQuery = (query || '').trim().toLowerCase();

    // Check cache first
    const parseEnvBool = (name: string, defaultVal: boolean) => {
      const v = process.env[name];
      if (v === undefined) return defaultVal;
      const low = String(v).toLowerCase();
      return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
    };

    const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);
    const cacheKey = `begin:v2:${normalizedQuery}:${enableGroupCollapse}`;

    const cachedResult = await redisCacheService.get(cacheKey);
    if (cachedResult) {
      const parsed = JSON.parse(cachedResult);
      const result = {
        content: [{
          type: 'text', text: JSON.stringify(parsed)
        }],
        structuredContent: parsed
      };
      
      mcpToolCalls.inc({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      const outputSize = JSON.stringify(result).length;
      mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
      
      timer({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      return result;
    }

    // Cache miss - perform search
    const candidateMap = await searchAndBuildCandidates(
      memoryStore,
      query,
      normalizedQuery,
      enableGroupCollapse
    );

    let headCandidates = Array.from(candidateMap.values())
      .sort((a, b) => (b.score - a.score));

    // Trim to 10 results
    if (headCandidates.length > 10) {
      headCandidates = headCandidates.slice(0, 10);
    }

    if (headCandidates.length === 0) {
      if (normalizedQuery === 'ai coding rules') {
        structuredLogger.warn('[begin-debug] no head memories after filtering');
      }
      const output = generateNoResultsOutput();
      const result = {
        content: [{
          type: 'text', text: JSON.stringify(output)
        }],
        structuredContent: output
      };
      
      mcpToolCalls.inc({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      const outputSize = JSON.stringify(result).length;
      mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
      
      timer({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      return result;
    }

    // Create results array and filter by score threshold
    const results = createResults(headCandidates);

    // If no results after filtering by score_threshold, return no_protocol
    if (results.length === 0) {
      const output = generateNoResultsOutput();
      // No caching of negative results
      const result = {
        content: [{
          type: 'text', text: JSON.stringify(output)
        }],
        structuredContent: output
      };
      
      mcpToolCalls.inc({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      const outputSize = JSON.stringify(result).length;
      mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
      
      timer({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      return result;
    }

    // Filter for perfect matches (score >= 1.0, always)
    const perfectMatches = results.filter(r => r.score >= 1.0);

    let output: any;

    if (perfectMatches.length === 1) {
      output = await generateSinglePerfectMatchOutput(perfectMatches[0]!, qdrantService);
    } else if (perfectMatches.length > 1) {
      output = await generateMultiplePerfectMatchesOutput(perfectMatches, qdrantService);
    } else {
      output = await generatePartialMatchOutput(results[0]!, qdrantService);
    }

    // Cache the result
    await redisCacheService.set(cacheKey, JSON.stringify(output), 300); // 5 min cache

    const result = {
      content: [{
        type: 'text', text: JSON.stringify(output)
      }],
      structuredContent: output
    };
    
    mcpToolCalls.inc({ 
      tool: toolName, 
      status: 'success',
      tenant_id: tenantId 
    });
    
    const outputSize = JSON.stringify(result).length;
    mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
    
    timer({ 
      tool: toolName, 
      status: 'success',
      tenant_id: tenantId 
    });
    
    return result;
  } catch (error) {
    mcpToolCalls.inc({ 
      tool: toolName, 
      status: 'error',
      tenant_id: tenantId 
    });
    mcpToolErrors.inc({ 
      tool: toolName, 
      status: 'error',
      tenant_id: tenantId 
    });
    timer({ 
      tool: toolName, 
      status: 'error',
      tenant_id: tenantId 
    });
    throw error;
  }
}


