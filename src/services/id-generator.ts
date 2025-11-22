/**
 * ID Generator Service for KAIROS
 *
 * Generates UUID-based identifiers for knowledge items.
 * Uses URI-based UUIDv5 for deterministic Qdrant IDs where appropriate.
*/

import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';
import { KairosError } from '../types/index.js';
import { structuredLogger } from '../utils/structured-logger.js';

// KAIROS namespace UUID for deterministic ID generation
// Generate once and hardcode for deployment consistency
export const KAIROS_NAMESPACE = '6f1d7e2b-8f7b-4b1e-9c8f-2f2f0b1a2e11';

export class IDGenerator {
    /**
     * Generate a protocol ID for protocols
     * This ID is shared across all steps in a protocol sequence
     * Uses full UUID for native Qdrant support
     *
     * @returns RFC 4122 UUID v4 string
     */
    static generateProtocolId(): string {
        return uuidv4();
    }

    /**
     * Generate a deterministic protocol_id from domain/type/task combination
     * This ensures the same domain/type/task always gets the same protocol_id
     *
     * @param domain - Knowledge domain
     * @param type - Knowledge type
     * @param task - Task identifier
     * @returns Deterministic UUIDv5 string
     */
    static generateDeterministicProtocolId(domain: string, type: string, task: string): string {
        const input = `${domain}:${type}:${task}`;
        return uuidv5(input, KAIROS_NAMESPACE);
    }

    /**
    /**
     * Generate a deterministic memory chain UUID (v5) from a label
     * Label is normalized (trim, collapse spaces, lower-case)
     */
    static generateChainUUIDv5(label: string): string {
        const normalized = (label || '').trim().replace(/\s+/g, ' ').toLowerCase();
        return uuidv5(normalized, KAIROS_NAMESPACE);
    }

    /**
     * Generate a UUID for unified protocol
     * Used for kairos://UUID URIs in the unified store protocol
     *
     * @returns RFC 4122 UUID v4 string
     */
    static generateUUID(): string {
        return crypto.randomUUID();
    }

    /**
     * Build Qdrant ID from human-readable URI using deterministic UUIDv5
     *
     * This enables URI-based retrieval: given a URI, we can always regenerate
     * the exact same Qdrant ID for direct lookup.
     *
     * @param humanUri - Full human-readable URI (e.g., "kairos://uuid" or legacy "kairos://ai/rule/coding-rules@lF5kZa9D/step/1")
     * @returns Deterministic UUIDv5 string
     *
     * @example
     * buildQdrantId("kairos://700468C5-2C80-4502-B60B-9A8C74044A35")
     * // Returns: "700468C5-2C80-4502-B60B-9A8C74044A35" (direct UUID)
     */
    static buildQdrantId(humanUri: string): string {
        return uuidv5(humanUri, KAIROS_NAMESPACE);
    }

    /**
     * Convert URI to Qdrant ID
     * Supports both new kairos://UUID and legacy URI formats
     *
     * @param uri - Full URI string
     * @returns UUID string for Qdrant operations
     */
    static qdrantIdFromUri(uri: string): string {
        structuredLogger.debug(`qdrantIdFromUri called with URI: ${uri}`);

        // kairos://mem/{uuid}
        const memPrefix = 'kairos://mem/';
        if (uri.startsWith(memPrefix)) {
            return uri.substring(memPrefix.length);
        }

        // kairos://{domain}/{type}/{task}/step/{step} (deterministic hashed id)
        if (uri.startsWith('kairos://') && uri.includes('/step/')) {
            return IDGenerator.buildQdrantId(uri);
        }

        // kairos://{uuid}
        const simplePrefix = 'kairos://';
        if (uri.startsWith(simplePrefix)) {
            const candidate = uri.substring(simplePrefix.length);
            // If it's a bare UUID, return it; otherwise, fall back to v5 hash of full URI
            if (/^[0-9a-fA-F-]{32,36}$/.test(candidate)) {
                return candidate;
            }
            return IDGenerator.buildQdrantId(uri);
        }

        throw new Error(`Unsupported URI format: ${uri}`);
    }

    // Using UUIDs exclusively going forward
}

/**
 * Collision Validator for KAIROS
 * 
 * Ensures composite key uniqueness before generating IDs
 * Prevents duplicate storage with retry mechanism
 */
export class CollisionValidator {
    /**
     * Check if composite key already exists
     * 
     * @param checkDuplicateFn - Function to check for existing duplicates
     * @param domain - Knowledge domain
     * @param type - Knowledge type
     * @param task - Task identifier
     * @param protocol - Optional protocol metadata
     * @returns true if collision detected
     */
    static async checkCompositeCollision(
        checkDuplicateFn: (
            domain: string,
            type: string,
            task: string,
            protocol?: { step: number; total: number; enforcement: string; skip_allowed: boolean }
        ) => Promise<string | null>,
        domain: string,
        type: string,
        task: string,
        protocol?: { step: number; total: number; enforcement: string; skip_allowed: boolean }
    ): Promise<boolean> {
        const existingId = await checkDuplicateFn(domain, type, task, protocol);
        return existingId !== null;
    }

    /**
     * Generate collision-free protocol ID with retry mechanism
     *
     * Attempts to generate unique protocol ID up to maxRetries times.
     * If composite key collision detected for non-protocols, throws error immediately.
     * For protocols, generates protocol_id that will be shared across all steps.
     *
     * @param checkDuplicateFn - Function to check for duplicates
     * @param domain - Knowledge domain
     * @param type - Knowledge type
     * @param task - Task identifier
     * @param protocol - Optional protocol metadata
     * @param maxRetries - Maximum retry attempts (default: 5)
     * @returns Object with protocolId and qdrantId
     * @throws Error if unable to generate unique ID
     */
    static async generateCollisionFreeId(
        checkDuplicateFn: (
            domain: string,
            type: string,
            task: string,
            protocol?: { step: number; total: number; enforcement: string; skip_allowed: boolean }
        ) => Promise<string | null>,
        domain: string,
        type: string,
        task: string,
        protocol?: { step: number; total: number; enforcement: string; skip_allowed: boolean }
    ): Promise<{ protocolId: string; qdrantId: string }> {
        // Check for composite key collision first
        const existingId = await checkDuplicateFn(domain, type, task, protocol);

        if (existingId) {
            const compositeKey = protocol
                ? `${domain}/${type}/${task}/step/${protocol.step}`
                : `${domain}/${type}/${task}`;

            throw new KairosError(
                `Composite key ${compositeKey} already exists with ID ${existingId}`,
                'DUPLICATE_KEY',
                409,
                { compositeKey, existingId }
            );
        }

        // Generate new protocol/knowledge ID (UUID)
        const protocolId = protocol
            ? IDGenerator.generateProtocolId()  // Shared across all protocol steps
            : uuidv4(); // Unique for non-protocol items

        // Note: We cannot build Qdrant ID here because we need the full URI
        // The caller must build the URI first, then generate Qdrant ID from it
        // Return just the protocolId; qdrantId will be generated from URI in storeMemory
        return { protocolId, qdrantId: '' }; // Empty qdrantId - will be set by caller
    }
}
