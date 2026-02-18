/**
 * KAIROS Type Definitions
 *
 * Simplified data structures for Stage 1 implementation
 */

// Protocol compliance check structure for postconditions
export interface ProtocolComplianceCheck {
    type: 'compliance_check';
    message: string;
    requirements: string[];
    nextAction: string;
    enforcement: 'sequential' | 'flexible';
}

// Protocol completion structure for final step
export interface ProtocolCompletion {
    type: 'protocol_complete';
    message: string;
    requirements: string[];
}

// Workflow Link for Prompt Processing Pipeline
export interface WorkflowLink {
    from_memory_uuid?: string;              // UUID of previous memory in workflow
    to_memory_uuid?: string;                // UUID of next memory in workflow
    step_number: number;                  // Sequential step number (1-based)
    step_type: 'rule' | 'snippet' | 'context' | 'pattern' | 'action';
    description: string;                  // Step description
    what_next: string[];                  // Next actions for this step
}

// Protocol metadata for sequential knowledge (e.g., rules, workflows)
// Protocol name comes from the task field, no separate name field needed
export interface ProtocolMetadata {
    step: number;                    // Current step number (1-based)
    total: number;                   // Total number of steps
    enforcement: 'sequential' | 'flexible';  // Must follow order or can skip
    skip_allowed: boolean;           // Can steps be skipped
    memory_uuid?: string;              // UUID for this memory (for cross-referencing)
}

// Core KAIROS memory structure - removed in favor of Qdrant SDK types
// Individual items are now represented as Qdrant points with embedded metadata

// Search parameters for KAIROS
export interface SearchParams {
    query: string;
    domain?: string | undefined;
    limit?: number;
}

// SearchMemoryParams interface for QdrantService
export interface SearchMemoryParams {
    query: string;
    domain?: string | undefined;
    limit?: number;
}

// Tool results
export interface MemoryResult {
    id: string;                  // Qdrant ID (UUID) - for internal operations
    description: string;
    content: string;
    confidence: number;
    relevance: number;
    domain: string;
    task: string;  // Task identifier (used for protocol grouping)
    type: string;  // Memory type (rule, context, snippet, pattern)
    tags: string[]; // Tags for categorization
    created_at: string;
    protocol?: ProtocolMetadata; // Protocol metadata if this is a protocol step
    quality_metadata?: {
        step_quality_score: number;
        step_quality: 'excellent' | 'high' | 'standard' | 'basic';
    };
}

// Store insight parameters
export interface StoreInsightParams {
    description_short: string;  // AI-provided short description (10-150 chars)
    description_full: string;   // Full content
    domain: string;             // Domain identifier (e.g., "ai", "docker", "machine-learning")
    task: string;
    type: string;
    tags: string[];
    protocol?: ProtocolMetadata;  // Optional protocol metadata for sequences
}

// Domain summary
export interface DomainSummary {
    domain: string;
    total_memories: number;
    top_categories: string[];
    recent_activity: any[]; // Qdrant point records (removed KnowledgeMemory dependency)
}

// MCP tool definitions
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

export class KairosError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: Record<string, any> // Add details field for additional error context
    ) {
        super(message);
        this.name = 'KairosError';
    }
}

// Quality metrics for knowledge items
export interface QualityMetrics {
    retrievalCount: number;
    successCount: number;
    partialCount: number;
    failureCount: number;
    lastRated: string | null;
    lastRater: string | null;
    qualityBonus: number;
    usageContext: string | null;

    // Implementation Success Rate fields
    implementation_stats?: ImplementationStats;
    healer_contributions?: HealerContributions;
    step_success_rates?: Record<string, StepSuccessRate>;
}

// Implementation statistics for success rate calculations
export interface ImplementationStats {
    total_attempts: number;           // Total times this knowledge was attempted
    success_attempts: number;         // Times it was successfully implemented
    model_success_rates: Record<string, ModelImplementationData>; // Per-model success tracking
    confidence_level: number;         // 0-1 confidence based on usage patterns
    last_implementation_attempt: string | null; // ISO timestamp
}

// Per-model implementation data for fairness calculations
export interface ModelImplementationData {
    attempts: number;                 // How many times this model tried this knowledge
    successes: number;                // How many times this model succeeded
    success_rate: number;             // Calculated success rate (0-1)
    wilson_lower: number;             // Wilson score interval lower bound
    wilson_upper: number;             // Wilson score interval upper bound
    last_attempt: string | null;      // ISO timestamp of last attempt
}

// Healer contributions tracking
export interface HealerContributions {
    total_healers: number;            // Number of models that improved this knowledge
    total_improvements: number;       // Total improvement actions taken
    healer_bonus_distributed: number;  // Total bonus points given to healers
    last_healed: string | null;       // ISO timestamp of last healing action
    healer_models: Record<string, HealerModelData>; // Per-healer tracking
}

// Per-healer model data
export interface HealerModelData {
    improvements_made: number;        // Number of improvements this healer made
    bonus_earned: number;             // Total bonus earned for healing
    last_healing_action: string | null; // ISO timestamp
}

// Protocol step success rate tracking
export interface StepSuccessRate {
    step_number: number;              // Protocol step number
    total_attempts: number;           // Total attempts on this step
    success_attempts: number;         // Successful implementations of this step
    success_rate: number;             // Calculated success rate (0-1)
    common_failures: string[];        // Common failure patterns observed
    last_attempt: string | null;      // ISO timestamp
}

// Configuration
export interface KAIROSConfig {
    qdrantUrl: string;
    collectionName: string;
    embeddingDimension: number;
}

// Quality metadata for knowledge items (stored per Qdrant point)
export interface QualityMetadata {
    step_quality_score: number;
    step_quality: 'excellent' | 'high' | 'standard' | 'basic';
}

// Mixed-Type Protocol Step (Phase 1 Enhancement)
// Allows different types within the same protocol (rule, snippet, context, pattern, action)
export interface MixedTypeProtocolStep {
    memory_uuid: string;                    // Unique identifier for this memory
    step_number: number;                  // Sequential step number (1-based)
    step_type: 'rule' | 'snippet' | 'context' | 'pattern' | 'action';  // Type of this step
    title?: string;                       // Optional step title
    description_short: string;            // Short description
    description_full: string;             // Full content (supports markdown)
    content_format: 'markdown' | 'plain' | 'code';  // Content formatting
    tags: string[];                       // Step-specific tags
    dependencies?: string[];              // UUIDs of memories this depends on
    is_optional: boolean;                 // Can this step be skipped
    estimated_duration?: string;          // Optional time estimate
    prerequisites?: string[];             // Prerequisites for this step
}

// Prompt Processing Pipeline Types (What Next Extraction and Workflow Linking)
export interface WhatNextMetadata {
    steps: string[];                      // Extracted "What Next" steps
    code_sections: string[];              // Code examples found in content
    workflow_metadata: WorkflowComplexityMetadata;
}

export interface WorkflowComplexityMetadata {
    has_what_next: boolean;               // Whether content has actionable next steps
    step_count: number;                   // Number of workflow steps
    workflow_complexity: 'simple' | 'moderate' | 'complex';
    estimated_completion: string;         // Time estimate for completion
}

export interface StructuredPrompt {
    full_description: string;             // Cleaned content without extracted sections
    code_sections: string[];              // Extracted code blocks
    what_next: string[];                  // Actionable next steps
    structured: boolean;                  // Whether content has structured sections
    has_workflow_steps: boolean;          // Whether content has workflow progression
}

// Enhanced memory with Prompt Processing Support (removed KnowledgeMemory dependency)
export interface EnhancedMemory {
    prompt_metadata?: WhatNextMetadata;   // Extracted prompt processing metadata
    workflow_links?: WorkflowLink[];      // Links to other steps in workflow
    executable_prompt?: string;           // Generated executable prompt
    // Qdrant point data
    uuid: string;
    payload: any;
}

// Search result enhancement for structured prompts
export interface EnhancedSearchResult {
    n: number;
    description_short: string;
    uri: string;
    type: string;
    domain: string;
    task: string;
    score: number;
    tags: string[];
    // Original protocol context
    uuid?: string;
    protocol_context?: {
        memory_uuid: string;
        step_number?: number;
    };
    protocol_flow?: {
        total_steps?: number;
    };
    // NEW: Prompt processing enhancements
    structured_prompt?: StructuredPrompt; // Extracted prompt structure
    what_next_steps?: string[];           // Direct access to next steps
    workflow_guidance?: WorkflowGuidance; // Navigation and completion info
}

export interface WorkflowGuidance {
    current_step: number;
    total_steps: number;
    next_actions: string[];
    completion_percentage: number;
    estimated_time_remaining: string;
    has_prerequisites: boolean;
    prerequisites?: string[];
}

// Store tool enhancement parameters
export interface EnhancedStoreParams {
    kb_name?: string;
    input: string | string[];
    llm_model_id: string;
    // Explicit operation support
    operation?: 'append' | 'replace' | 'insert-before' | 'insert-after';
    target?: string;
    // NEW: Prompt processing options
    extract_prompts?: boolean;            // Enable prompt extraction
    generate_workflow_links?: boolean;    // Enable workflow linking
    structured_output?: boolean;          // Return structured prompts
}

