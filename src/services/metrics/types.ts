/**
 * TypeScript types for Prometheus metrics.
 */

export interface MetricLabels {
  tenant_id: string;
  [key: string]: string | number | undefined;
}

export interface MCPToolLabels extends MetricLabels {
  tool: string;
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

