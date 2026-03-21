/**
 * Re-exports from canonical tool schemas. Do not define local types here.
 */
import type { ForwardOutput, ForwardSolution } from "../../tools/forward_schema.js";
import type { RewardOutput } from "../../tools/reward_schema.js";

export type BeginOutput = ForwardOutput;
export type NextOutput = ForwardOutput;
export type AttestOutput = RewardOutput;
export type SolutionSubmission = ForwardSolution;
export type { ForwardOutput, ForwardSolution, RewardOutput };

export type Challenge = ForwardOutput["contract"];
export type KairosStep = NonNullable<ForwardOutput["current_layer"]>;
export type ProofOfWorkSubmission = SolutionSubmission;
export type ProofOfWorkType = Challenge["type"];
