/**
 * TypeScript types for Prometheus metrics labels.
 * All metrics MUST include tenant_id label.
 */

export interface MetricLabels {
  tenant_id: string;
  [key: string]: string | number | undefined;
}

export interface MCPToolLabels extends MetricLabels {
  tool: 'kairos_mint' | 'kairos_begin' | 'kairos_next' | 'kairos_attest' | 'kairos_update' | 'kairos_delete';
  status: 'success' | 'error' | 'timeout';
}

export interface MemoryOperationLabels extends MetricLabels {
  quality?: 'excellent' | 'high' | 'standard' | 'basic';
  operation?: 'store' | 'retrieve' | 'search' | 'update' | 'delete';
}

export interface AgentLabels extends MetricLabels {
  agent_id: string;
  quality?: 'excellent' | 'high' | 'standard' | 'basic';
}

export interface QdrantOperationLabels extends MetricLabels {
  operation: 'search' | 'retrieve' | 'upsert' | 'delete' | 'update';
  status: 'success' | 'error';
}

export interface QualityLabels extends MetricLabels {
  quality_tier: 'excellent' | 'high' | 'standard' | 'basic';
}

export interface EmbeddingLabels extends MetricLabels {
  provider: 'openai' | 'tei' | 'local';
  status: 'success' | 'error';
}

export interface HTTPLabels extends MetricLabels {
  method: string;
  route: string;
  status: string;
}

