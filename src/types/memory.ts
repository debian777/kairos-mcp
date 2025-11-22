export interface ChainInfo {
  id: string;                      // Stable chain identifier (e.g., head UUID)
  label: string;                   // Title of the chain (H1) when part of a header-sliced document
  step_index: number;              // 1-based step index in the chain
  step_count: number;              // Total number of steps in the chain
}

export interface Memory {
  memory_uuid: string;
  label: string;
  tags: string[];
  text: string;
  llm_model_id: string;
  created_at: string;
  chain?: ChainInfo;               // Memory chain metadata (formerly protocol)
}
