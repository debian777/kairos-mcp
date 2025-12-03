export interface ChainInfo {
  id: string;                      // Stable chain identifier (e.g., head UUID)
  label: string;                   // Title of the chain (H1) when part of a header-sliced document
  step_index: number;              // 1-based step index in the chain
  step_count: number;              // Total number of steps in the chain
}

export type ProofOfWorkType = 'shell' | 'mcp' | 'user_input' | 'comment';

export interface ProofOfWorkDefinition {
  type?: ProofOfWorkType;  // Optional for backward compatibility, defaults to 'shell'
  // Shell-specific fields (backward compatible)
  cmd?: string;
  timeout_seconds?: number;
  required: boolean;
  // Type-specific fields
  shell?: {
    cmd: string;
    timeout_seconds: number;
  };
  mcp?: {
    tool_name: string;
    expected_result?: any;
  };
  user_input?: {
    prompt?: string;
  };
  comment?: {
    min_length?: number;
  };
}

export interface Memory {
  memory_uuid: string;
  label: string;
  tags: string[];
  text: string;
  llm_model_id: string;
  created_at: string;
  chain?: ChainInfo;               // Memory chain metadata (formerly protocol)
  proof_of_work?: ProofOfWorkDefinition;
}
