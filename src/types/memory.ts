export interface ChainInfo {
  id: string;                      // Stable chain identifier (e.g., head UUID)
  label: string;                   // Title of the chain (H1) when part of a header-sliced document
  step_index: number;              // 1-based step index in the chain
  step_count: number;              // Total number of steps in the chain
  protocol_version?: string;       // Optional semver from frontmatter or kairos_mint (for agent comparison)
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
    /** Optional; default bash -c when omitted. */
    interpreter?: string;
    /** Interpreter-specific flags (do not duplicate auto-injected -c / -e). */
    flags?: string[];
    /** Positional args after script body (e.g. bash -- "$1"). */
    args?: string[];
    /** Working directory for execution (executor resolves $KAIROS_WORK_DIR, paths). */
    workdir?: string;
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
  /** Qdrant payload space_id when present; used to scope sibling chain scrolls to spaces we already read from. */
  space_id?: string;
  /** Qdrant payload: exact routing key for kairos_begin(key). */
  slug?: string;
}
