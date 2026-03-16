/**
 * Re-exports from canonical tool schemas. Do not define local types here.
 */
import type { BeginOutput } from "../../tools/kairos_begin.js";
import type { NextOutput } from "../../tools/kairos_next.js";
import type { AttestOutput } from "../../tools/kairos_attest_schema.js";
import type { SolutionSubmission } from "../../tools/kairos_next_schema.js";

export type { BeginOutput, NextOutput, AttestOutput, SolutionSubmission };

export type Challenge = BeginOutput["challenge"];
export type KairosStep = NonNullable<BeginOutput["current_step"]>;
/** Alias for SolutionSubmission (canonical type from kairos_next_schema). */
export type ProofOfWorkSubmission = SolutionSubmission;
export type ProofOfWorkType = Challenge["type"];
