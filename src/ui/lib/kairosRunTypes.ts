export type ProofOfWorkType = "shell" | "mcp" | "user_input" | "comment";

export type Challenge = {
  type: ProofOfWorkType;
  description?: string;
  nonce?: string;
  proof_hash?: string;
  shell?: {
    cmd?: string;
    timeout_seconds?: number;
  };
  mcp?: {
    tool_name?: string;
    expected_result?: unknown;
  };
  user_input?: {
    prompt?: string;
  };
  comment?: {
    min_length?: number;
  };
};

export type ProofOfWorkSubmission = {
  type: ProofOfWorkType;
  nonce?: string;
  proof_hash?: string;
  /** @deprecated v1 compat only; avoid using in new clients. */
  previousProofHash?: string;
  shell?: {
    exit_code: number;
    stdout?: string;
    stderr?: string;
    duration_seconds?: number;
  };
  mcp?: {
    tool_name: string;
    arguments?: unknown;
    result: unknown;
    success: boolean;
  };
  user_input?: {
    confirmation: string;
    timestamp?: string;
  };
  comment?: {
    text: string;
  };
};

export type KairosStep = {
  uri: string;
  content: string;
  mimeType: string;
};

export type KairosBeginResponse = {
  must_obey: boolean;
  current_step: KairosStep;
  challenge: Challenge;
  message?: string;
  next_action?: string;
  error_code?: string;
  retry_count?: number;
  proof_hash?: string;
  metadata?: unknown;
};

export type KairosNextResponse = KairosBeginResponse;

export type KairosAttestResponse = {
  results: Array<{
    uri: string;
    outcome: "success" | "failure";
    quality_bonus: number;
    message: string;
    rated_at: string;
  }>;
  total_rated: number;
  total_failed: number;
  metadata?: unknown;
};

