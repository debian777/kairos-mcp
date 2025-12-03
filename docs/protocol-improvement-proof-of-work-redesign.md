# KAIROS Protocol Improvement: Proof-of-Work Redesign

**Status**: Draft Proposal  
**Date**: 2025-01-29  
**Author**: Protocol Design Team

## Executive Summary

This document proposes a comprehensive redesign of the KAIROS protocol to address critical issues with proof-of-work (POW) enforcement and workflow determinism. The redesign introduces a more deterministic, flexible, and enforceable proof-of-work system that accommodates various proof types (shell commands, MCP tools, user input, etc.) while ensuring models cannot skip verification steps.

## Current Problems

### 1. Proof-of-Work is Non-Deterministic and Optional

**Problem**: The current `kairos_next` tool makes proof-of-work optional, allowing models to skip verification steps entirely.

**Current Behavior**:

- `kairos_next` includes `proof_of_work` field as optional
- Models frequently skip POW submission
- No enforcement mechanism prevents progression without proof
- The `required` flag in `ProofOfWorkDefinition` exists but doesn't effectively block progression

**Impact**:

- Protocols cannot guarantee verification
- Quality assurance is compromised
- Models bypass critical validation steps

### 2. Proof-of-Work Fields are Confusing and Over-Complex

**Current POW Structure**:

```typescript
proof_of_work_result: {
  uri: string;                    // URI of step that produced result
  exit_code: number;              // Exit code from command
  stdout?: string;                // Optional stdout
  stderr?: string;                // Optional stderr
  duration_seconds?: number;       // Optional duration
  executed_at?: string;           // Optional timestamp
}
```

**Problems**:

- Too many optional fields create confusion
- Field names don't clearly indicate purpose
- Structure assumes shell command execution
- Doesn't accommodate MCP tools, user input, or other proof types
- Models struggle to understand which fields are required vs optional

### 3. Theoretical Requirement vs. Reality Mismatch

**Current Logic**:

- Code checks `memory.proof_of_work.required` for steps 2+
- `ensurePreviousProofCompleted()` attempts to block progression
- However, models can still call `kairos_next` without providing proof

**Reality**:

- Enforcement is weak and easily bypassed
- Step 1 has no POW requirement (by design)
- Steps 2+ theoretically require POW but enforcement fails
- No clear distinction between step 1 and subsequent steps in API

### 4. Proof-of-Work is Shell-Command-Centric

**Current Limitation**:

- POW structure assumes shell command execution
- Fields like `exit_code`, `stdout`, `stderr` are shell-specific
- Doesn't support:
  - MCP tool calls as proof
  - User input/confirmation
  - Visual verification
  - Other non-shell verification methods

**Impact**:

- Protocols requiring non-shell verification cannot be properly enforced
- Forces workarounds and hacks
- Limits protocol design flexibility

## Proposed Solution

### Overview

The redesign introduces a **deterministic, three-phase workflow** with clear separation between search, first step, and subsequent steps:

1. **Search Phase**: `kairos_search` (renamed from `kairos_begin`)
2. **First Step Phase**: `kairos_begin` (new, no POW required)
3. **Subsequent Steps Phase**: `kairos_next` (POW required)
4. **Completion Phase**: `kairos_attest` (POW required)

### Detailed Design

#### Phase 1: Search (`kairos_search`)

**Purpose**: Find and select protocol chains

**Changes**:

- Rename `kairos_begin` → `kairos_search`
- No functional changes to search logic
- Returns `start_here` URI pointing to step 1

**API**:

```typescript
// Input
{
  query: string;  // Search query for chain heads
}

// Output
{
  must_obey: boolean;
  start_here?: string;  // URI of step 1 (kairos://mem/{uuid})
  chain_label?: string;
  total_steps?: number;
  protocol_status: string;
  // ... existing search result fields
}
```

**Rationale**:

- Clearer naming: "search" accurately describes the operation
- Separates search from protocol execution
- Prepares for new `kairos_begin` that handles step 1

#### Phase 2: First Step (`kairos_begin` - NEW)

**Purpose**: Read and execute the first step without proof-of-work requirement

**Design**:

- Based on `kairos_next` but **without POW fields**
- Specifically for step 1 (step_index === 1)
- No proof-of-work required or expected
- Clean, simple interface for initial step

**API**:

```typescript
// Input
{
  uri: string;  // URI of step 1 (from kairos_search.start_here)
}

// Output
{
  must_obey: boolean;
  current_step: {
    uri: string;
    content: string;
    mimeType: 'text/markdown';
  };
  next_step: {
    uri: string;
    position: string;  // e.g., "2/5"
    label: string;
  } | null;
  protocol_status: 'continue' | 'completed';
  // NO proof_of_work field
  // NO proof_of_work_result field
}
```

**Rationale**:

- Step 1 is typically setup/context - no verification needed
- Cleaner API without confusing optional POW fields
- Models cannot accidentally skip POW on step 1 (it's not expected)
- Clear separation: step 1 = no POW, step 2+ = POW required

**Implementation Notes**:

- Validate that `uri` points to step 1 (chain.step_index === 1)
- Return error if step_index !== 1
- Reuse `kairos_next` logic but strip POW-related code

#### Phase 3: Subsequent Steps (`kairos_next` - MODIFIED)

**Purpose**: Read and execute steps 2+ with **required** proof-of-work

**Changes**:

- **Make proof-of-work REQUIRED** (not optional)
- Simplify POW structure to be more flexible
- Support multiple proof types (shell, MCP, user input, etc.)
- Enforce POW before allowing progression

**API**:

```typescript
// Input
{
  uri: string;  // URI of current step (step 2+)
  proof_of_work: {  // REQUIRED (not optional)
    type: 'shell' | 'mcp' | 'user_input' | 'comment';
    // Type-specific fields (union type)
    shell?: {
      exit_code: number;
      stdout?: string;
      stderr?: string;
    };
    mcp?: {
      tool_name: string;
      result: any;  // Tool-specific result
    };
    user_input?: {
      confirmation: string;  // User's confirmation text
    };
    comment?: {
      text: string;  // Short verification comment
    };
  };
}

// Output
{
  must_obey: boolean;
  current_step: {
    uri: string;
    content: string;
    mimeType: 'text/markdown';
  };
  next_step: {
    uri: string;
    position: string;
    label: string;
  } | null;
  protocol_status: 'continue' | 'completed' | 'blocked';
  proof_of_work_required: {
    type: 'shell' | 'mcp' | 'user_input' | 'comment';
    description: string;  // Human-readable description of what needs proof
    // Type-specific requirements
    shell?: {
      cmd: string;
      timeout_seconds: number;
    };
    mcp?: {
      tool_name: string;
      expected_result?: any;
    };
    // etc.
  };
}
```

**Key Changes**:

1. **POW is REQUIRED**: Input schema rejects requests without `proof_of_work`
2. **Flexible proof types**: Supports shell, MCP, user input, comment
3. **Simplified structure**: Type-specific fields instead of generic optional fields
4. **Clear requirements**: Output includes `proof_of_work_required` describing what's needed
5. **Enforcement**: Block progression if POW is missing or invalid

**Rationale**:

- Required field prevents skipping
- Flexible types accommodate different verification methods
- Clear structure reduces confusion
- Type-specific fields are more intuitive

**Validation Logic**:

```typescript
// Pseudo-code
if (step_index === 1) {
  throw Error("Use kairos_begin for step 1");
}

if (!proof_of_work) {
  return {
    protocol_status: "blocked",
    message: "Proof of work is required for steps 2+",
  };
}

// Validate proof type matches step requirements
if (memory.proof_of_work) {
  const requiredType = memory.proof_of_work.type;
  if (proof_of_work.type !== requiredType) {
    return {
      protocol_status: "blocked",
      message: `Expected proof type: ${requiredType}, got: ${proof_of_work.type}`,
    };
  }
}

// Validate proof content based on type
// ... type-specific validation
```

#### Phase 4: Completion (`kairos_attest` - MODIFIED)

**Purpose**: Attest step completion with proof-of-work

**Changes**:

- **Make proof-of-work REQUIRED** (even if step had no POW marker)
- Allow "comment" type proof for steps without explicit POW requirements
- Ensure all steps are verified before completion

**API**:

```typescript
// Input
{
  uri: string;
  outcome: 'success' | 'failure';
  message: string;
  proof_of_work: {  // REQUIRED (new)
    type: 'shell' | 'mcp' | 'user_input' | 'comment';
    // ... same structure as kairos_next
  };
  quality_bonus?: number;
  llm_model_id?: string;
}

// Output
{
  results: Array<{
    uri: string;
    outcome: string;
    quality_bonus: number;
    message: string;
    rated_at: string;
  }>;
  total_rated: number;
  total_failed: number;
}
```

**Rationale**:

- Even steps without explicit POW markers should have verification
- Comment-type proof allows simple verification ("verified manually", "checked output", etc.)
- Ensures complete audit trail
- Prevents attestation without verification

**Comment-Type Proof Example**:

```typescript
{
  type: 'comment',
  comment: {
    text: 'Verified output file exists and contains expected data'
  }
}
```

### Proof-of-Work Type System

#### Type: `shell`

For shell command execution (current use case).

```typescript
{
  type: 'shell',
  shell: {
    exit_code: number;      // Required
    stdout?: string;        // Optional
    stderr?: string;        // Optional
    duration_seconds?: number; // Optional
  }
}
```

#### Type: `mcp`

For MCP tool calls as proof.

```typescript
{
  type: 'mcp',
  mcp: {
    tool_name: string;      // e.g., 'filesystem_read_file'
    arguments: any;         // Tool arguments
    result: any;            // Tool result
    success: boolean;       // Whether tool succeeded
  }
}
```

#### Type: `user_input`

For user confirmation/input as proof.

```typescript
{
  type: 'user_input',
  user_input: {
    confirmation: string;   // User's confirmation text
    timestamp?: string;     // When confirmation occurred
  }
}
```

#### Type: `comment`

For simple verification comments (fallback for steps without explicit POW).

```typescript
{
  type: 'comment',
  comment: {
    text: string;           // Verification comment
  }
}
```

### Workflow Example

**Complete Flow**:

1. **Search**:

   ```typescript
   kairos_search({ query: "coding protocol" });
   // Returns: { start_here: "kairos://mem/abc-123", ... }
   ```

2. **Read Step 1** (no POW):

   ```typescript
   kairos_begin({ uri: "kairos://mem/abc-123" });
   // Returns: { current_step: {...}, next_step: { uri: "kairos://mem/def-456", position: "2/5" } }
   ```

3. **Read Step 2** (POW required):

   ```typescript
   kairos_next({
     uri: "kairos://mem/def-456",
     proof_of_work: {
       type: "shell",
       shell: { exit_code: 0, stdout: "file created" },
     },
   });
   // Returns: { current_step: {...}, next_step: {...}, proof_of_work_required: {...} }
   ```

4. **Continue Steps 3-5** (each requires POW):

   ```typescript
   // Step 3, 4, 5... each requires proof_of_work
   ```

5. **Attest Completion** (POW required):
   ```typescript
   kairos_attest({
     uri: "kairos://mem/xyz-789", // Last step
     outcome: "success",
     message: "Protocol completed successfully",
     proof_of_work: {
       type: "comment",
       comment: { text: "All steps verified and completed" },
     },
   });
   ```

## Benefits

### 1. Deterministic Workflow

- **Clear phases**: Search → Step 1 → Steps 2+ → Attest
- **No ambiguity**: Each phase has distinct purpose and requirements
- **Enforced progression**: Cannot skip POW on steps 2+
- **Predictable behavior**: Models know exactly what's required at each phase

### 2. Flexible Proof System

- **Multiple proof types**: Shell, MCP, user input, comment
- **Accommodates various verification methods**
- **Future-proof**: Easy to add new proof types
- **No shell-centric assumptions**: Works for any verification method

### 3. Simplified API

- **Step 1 is simple**: No POW fields to confuse models
- **Steps 2+ are clear**: POW is required, structure is type-specific
- **Less optional fields**: Reduces confusion
- **Better error messages**: Clear requirements in response

### 4. Better Enforcement

- **Required fields**: Schema validation prevents skipping
- **Type checking**: Validates proof type matches requirements
- **Blocking behavior**: Returns `protocol_status: 'blocked'` if POW invalid
- **Complete audit trail**: All steps verified before completion

## Implementation Plan

### Phase 1: Rename and Create New Tools

1. **Rename `kairos_begin` → `kairos_search`**

   - Update tool registration
   - Update all references
   - Maintain backward compatibility (deprecation period)

2. **Create new `kairos_begin`**

   - Copy `kairos_next` logic
   - Remove POW fields
   - Add step_index validation (must be 1)
   - Update tool registration

3. **Update `kairos_next`**

   - Make `proof_of_work` required
   - Implement new POW type system
   - Add `proof_of_work_required` to output
   - Update validation logic

4. **Update `kairos_attest`**
   - Add required `proof_of_work` field
   - Support comment-type proof
   - Update validation

### Phase 2: Update Data Models

1. **Extend `ProofOfWorkDefinition`**:

   ```typescript
   interface ProofOfWorkDefinition {
     type: "shell" | "mcp" | "user_input" | "comment";
     // Type-specific fields
     shell?: { cmd: string; timeout_seconds: number };
     mcp?: { tool_name: string; expected_result?: any };
     // etc.
     required: boolean; // Keep for backward compatibility
   }
   ```

2. **Update `ProofOfWorkResultRecord`**:
   ```typescript
   interface ProofOfWorkResultRecord {
     type: "shell" | "mcp" | "user_input" | "comment";
     // Type-specific result fields
     shell?: { exit_code: number; stdout?: string; stderr?: string };
     mcp?: { tool_name: string; result: any; success: boolean };
     user_input?: { confirmation: string; timestamp?: string };
     comment?: { text: string };
     executed_at: string;
   }
   ```

### Phase 3: Migration Strategy

1. **Backward Compatibility Period** (3 months):

   - Keep old `kairos_begin` as deprecated alias
   - Accept old POW format in `kairos_next` (convert to new format)
   - Log deprecation warnings

2. **Update Documentation**:

   - Protocol guides
   - API documentation
   - Example code
   - Migration guide

3. **Update Existing Protocols**:
   - Convert POW markers to new type system
   - Add type information to existing memories
   - Test with existing protocols

### Phase 4: Testing and Validation

1. **Unit Tests**:

   - New `kairos_begin` (step 1 only)
   - Updated `kairos_next` (POW required)
   - Updated `kairos_attest` (POW required)
   - POW type validation

2. **Integration Tests**:

   - Complete workflow (search → begin → next → attest)
   - POW enforcement (blocking behavior)
   - Multiple proof types
   - Error handling

3. **Protocol Compatibility Tests**:
   - Existing protocols work with new system
   - Migration path validated
   - Backward compatibility maintained

## Open Questions

1. **Backward Compatibility**: How long should we maintain old `kairos_begin` as alias?

   - Recommendation: 3 months deprecation period

2. **POW Type Detection**: How should we determine required POW type for a step?

   - Option A: From `proof_of_work` marker in markdown (parse `type:` field)
   - Option B: Default to `shell` for existing protocols, allow override
   - Option C: Infer from proof command (shell command → shell type, etc.)

3. **Comment-Type Proof**: What's the minimum length/quality for comment proofs?

   - Recommendation: Minimum 10 characters, must be meaningful (not just "ok" or "done")

4. **MCP Tool Proof**: How do we validate MCP tool results?

   - Option A: Compare against expected result
   - Option B: Just verify tool was called successfully
   - Option C: Custom validation per tool type

5. **Step 1 Exception**: Should step 1 ever require POW?
   - Recommendation: No, keep step 1 simple. If verification needed, make it step 2.

## Alternatives Considered

### Alternative 1: Keep `kairos_begin` as search, add `kairos_first` for step 1

**Pros**:

- Clearer naming (`first` vs `begin`)
- Less confusion about what `begin` does

**Cons**:

- More tools to learn
- `begin` is more intuitive for "starting the protocol"

**Decision**: Use `kairos_begin` for step 1 (more intuitive, fewer tools)

### Alternative 2: Make POW optional but strongly encouraged

**Pros**:

- More flexible
- Doesn't break existing workflows

**Cons**:

- Models still skip POW
- Doesn't solve the core problem
- Enforcement is weak

**Decision**: Make POW required (solves the core problem)

### Alternative 3: Keep single `kairos_next` with step_index detection

**Pros**:

- Fewer tools
- Simpler API surface

**Cons**:

- Tried this, doesn't work (models skip POW)
- Less clear separation
- Harder to enforce

**Decision**: Separate tools for step 1 vs steps 2+ (clearer, more enforceable)

## Conclusion

This redesign addresses all identified problems:

1. ✅ **Deterministic workflow**: Clear phases with distinct requirements
2. ✅ **Required POW**: Cannot skip verification on steps 2+
3. ✅ **Simplified structure**: Type-specific fields, less confusion
4. ✅ **Flexible proof types**: Supports shell, MCP, user input, comment
5. ✅ **Better enforcement**: Schema validation and blocking behavior

The proposed changes create a more robust, flexible, and enforceable protocol system while maintaining backward compatibility during migration.

## Next Steps

1. **Review and feedback** on this proposal
2. **Finalize POW type system** (address open questions)
3. **Create detailed implementation plan** with timelines
4. **Begin Phase 1 implementation** (rename and create tools)
5. **Test with existing protocols** to ensure compatibility

---

**Feedback and Discussion**: Please provide feedback on this proposal, especially regarding:

- POW type system design
- Backward compatibility strategy
- Migration timeline
- Open questions listed above
