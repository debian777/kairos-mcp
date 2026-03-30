export interface AdapterInfo {
  id: string; // Stable adapter identifier (typically the head layer UUID)
  name: string; // Adapter title (H1)
  layer_index: number; // 1-based layer index in the adapter
  layer_count: number; // Total number of layers in the adapter
  protocol_version?: string; // Optional semver carried from frontmatter/train input
  activation_patterns?: string[];
  reward_signal?: string; // Optional trailing Reward Signal/Completion Rule markdown section
}

export interface TensorOutputSpec {
  name: string;
  type: string;
  min_length?: number;
  max_length?: number;
  min_items?: number;
  max_items?: number;
}

export interface TensorContractDetails {
  required_inputs: string[];
  output: TensorOutputSpec;
  merge?: string;
  condition?: string;
}

export type InferenceContractType = 'tensor' | 'shell' | 'mcp' | 'user_input' | 'comment';

export interface InferenceContractDefinition {
  type?: InferenceContractType;
  required: boolean;
  // Shell-specific convenience fields retained for older internal helpers.
  cmd?: string;
  timeout_seconds?: number;
  shell?: {
    cmd: string;
    timeout_seconds: number;
    interpreter?: string;
    flags?: string[];
    args?: string[];
    workdir?: string;
  };
  mcp?: {
    tool_name: string;
    expected_result?: unknown;
  };
  user_input?: {
    prompt?: string;
  };
  comment?: {
    min_length?: number;
  };
  tensor?: TensorContractDetails;
}

export interface TensorValue {
  name: string;
  value: unknown;
}

export interface RewardRecord {
  outcome: 'success' | 'failure';
  score?: number;
  signed_score?: number;
  quality_bonus?: number;
  feedback?: string;
  rater?: string;
  rubric_version?: string;
  llm_model_id?: string;
  grader_kind?: 'human' | 'model' | 'unknown';
  evaluation_label?: 'gold' | 'silver' | 'bronze' | 'rejected';
  exportable_for_sft?: boolean;
  exportable_for_preference?: boolean;
  sft_blockers?: string[];
  preference_blockers?: string[];
  rated_at: string;
}

export interface ExecutionTrace {
  execution_id: string;
  adapter_uri: string;
  layer_uri: string;
  layer_index: number;
  created_at: string;
  activation_query?: string;
  layer_instructions?: string;
  tensor_in: Record<string, unknown>;
  tensor_out?: TensorValue;
  trace?: string;
  raw_solution?: unknown;
  reward?: RewardRecord;
  merge_depth?: number;
}

export interface Memory {
  memory_uuid: string;
  /** Qdrant payload space when present (export / adapter scroll scoping). */
  space_id?: string;
  label: string;
  slug?: string;
  tags: string[];
  text: string;
  llm_model_id: string;
  created_at: string;
  adapter?: AdapterInfo;
  inference_contract?: InferenceContractDefinition;
}

// Transitional alias kept to reduce churn while the internal codebase moves to adapter terminology.
export type ProofOfWorkType = Exclude<InferenceContractType, 'tensor'>;
export type ProofOfWorkDefinition = InferenceContractDefinition;
