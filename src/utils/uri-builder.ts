/**
 * URI Builder for KAIROS Resources
 *
 * Generates canonical kairos:// URIs for:
 * - Domain/type/task resources: kairos://{domain}/{type}/{task}
 * - Protocol steps: kairos://{domain}/{type}/{task}/step/{n}
 * - Unified UUID resources: kairos://{uuid}
 * - Templates: kairos://templates/{template_type}/{param}
 */

/**
 * Knowledge item structure with optional protocol metadata
 * Simplified version that accepts either strict types or generic strings
 */
export interface KnowledgeItem {
    domain: string;
    type: string; // Accept any string to work with KnowledgeMemory
    task: string;
    id?: string; // Optional identifier for URI building
    protocol?: {
        step?: number;
        total: number;
        enforcement: 'sequential' | 'flexible';
        skip_allowed?: boolean;
    } | undefined;
}

/**
 * URI patterns for validation
 */
export const URI_PATTERNS = {
    // Canonical kairos:// patterns
    kb_domain_type_task: /^kb:\/\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/,
    kb_protocol_step: /^kb:\/\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/step\/\d+$/,
    // Hierarchical kairos:// patterns (support arbitrary depth paths)
    kb_hierarchical: /^kb:\/\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/,
    kb_hierarchical_step: /^kb:\/\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/step\/\d+$/,
    // Template patterns
    template_search: /^kb:\/\/templates\/search\/[a-z0-9-]+$/,
    template_store: /^kb:\/\/templates\/store\/(rule|pattern|snippet|context)$/,
    template_sequence: /^kb:\/\/templates\/sequence\/\d+\/\d+$/,
} as const;



/**
 * Build kairos://{domain}/{type}/{task} URI for domain/type/task format
 *
 * @param domain - Knowledge domain (e.g., 'typescript', 'docker')
 * @param type - Knowledge type (e.g., 'rule', 'pattern', 'context')
 * @param task - Task identifier (e.g., 'error-handling', 'networking')
 * @returns kairos:// domain/type/task URI
 *
 * @example
 * buildDomainTypeTaskURI('docker', 'pattern', 'networking')
 * // Returns: 'kairos://docker/pattern/networking'
 */
export function buildDomainTypeTaskURI(domain: string, type: string, task: string): string {
    if (!domain || !type || !task) {
        throw new Error('buildDomainTypeTaskURI requires domain, type, and task parameters');
    }

    // Validate domain/type/task format (lowercase, alphanumeric, hyphens)
    const validFormat = /^[a-z0-9-]+$/;
    if (!validFormat.test(domain) || !validFormat.test(type) || !validFormat.test(task)) {
        throw new Error('Domain, type, and task must be lowercase alphanumeric with hyphens only');
    }

    return `kairos://${domain}/${type}/${task}`;
}

/**
 * Build kairos://{domain}/{type}/{task}/step/{step} URI for protocol steps
 *
 * @param domain - Knowledge domain
 * @param type - Knowledge type
 * @param task - Task identifier
 * @param step - Step number (1-based)
 * @returns kairos:// protocol step URI
 *
 * @example
 * buildProtocolStepURI('ai', 'rule', 'coding-rules', 3)
 * // Returns: 'kairos://ai/rule/coding-rules/step/3'
 */
export function buildProtocolStepURI(domain: string, type: string, task: string, step: number): string {
    if (!domain || !type || !task || step === undefined || step === null) {
        throw new Error('buildProtocolStepURI requires domain, type, task, and step parameters');
    }

    if (!Number.isInteger(step) || step < 1) {
        throw new Error('Step must be a positive integer');
    }

    // Validate domain/type/task format
    const validFormat = /^[a-z0-9-]+$/;
    if (!validFormat.test(domain) || !validFormat.test(type) || !validFormat.test(task)) {
        throw new Error('Domain, type, and task must be lowercase alphanumeric with hyphens only');
    }

    return `kairos://${domain}/${type}/${task}/step/${step}`;
}

/**
 * Build hierarchical kairos://{path}/step/{step} URI for protocol steps
 *
 * @param path - Hierarchical path components (e.g., ['ai', 'coding', 'rules'])
 * @param step - Step number (1-based)
 * @returns kairos:// hierarchical protocol step URI
 *
 * @example
 * buildHierarchicalProtocolStepURI(['ai', 'coding', 'rules'], 3)
 * // Returns: 'kairos://ai/coding/rules/step/3'
 */
export function buildHierarchicalProtocolStepURI(path: string[], step: number): string {
    if (!path || path.length === 0 || step === undefined || step === null) {
        throw new Error('buildHierarchicalProtocolStepURI requires path array and step parameters');
    }

    if (!Number.isInteger(step) || step < 1) {
        throw new Error('Step must be a positive integer');
    }

    // Validate path components format
    const validFormat = /^[a-z0-9-]+$/;
    for (const component of path) {
        if (!component || !validFormat.test(component)) {
            throw new Error('Path components must be non-empty lowercase alphanumeric with hyphens only');
        }
    }

    const pathString = path.join('/');
    return `kairos://${pathString}/step/${step}`;
}

/**
 * Build hierarchical kairos://{path} URI for non-step resources
 *
 * @param path - Hierarchical path components
 * @returns kairos:// hierarchical URI
 *
 * @example
 * buildHierarchicalURI(['ai', 'coding', 'rules', 'mcp'])
 * // Returns: 'kairos://ai/coding/rules/mcp'
 */
export function buildHierarchicalURI(path: string[]): string {
    if (!path || path.length === 0) {
        throw new Error('buildHierarchicalURI requires path array parameter');
    }

    // Validate path components format
    const validFormat = /^[a-z0-9-]+$/;
    for (const component of path) {
        if (!component || !validFormat.test(component)) {
            throw new Error('Path components must be non-empty lowercase alphanumeric with hyphens only');
        }
    }

    const pathString = path.join('/');
    return `kairos://${pathString}`;
}

/**
 * Build template URI
 * 
 * @param templateType - Type of template (search, store, sequence)
 * @param param - Template parameter (domain for search, type for store, step/total for sequence)
 * @returns Template URI
 * 
 * @example
 * buildTemplateURI('search', 'ai')
 * // Returns: 'kairos://templates/search/ai'
 *
 * @example
 * buildTemplateURI('store', 'rule')
 * // Returns: 'kairos://templates/store/rule'
 *
 * @example
 * buildTemplateURI('sequence', '5/12')
 * // Returns: 'kairos://templates/sequence/5/12'
 */
export function buildTemplateURI(templateType: 'search' | 'store' | 'sequence', param: string): string {
    return `kairos://templates/${templateType}/${param}`;
}

/**
 * Validate URI format
 *
 * @param uri - URI to validate
 * @returns true if URI matches any known pattern
 *
 * @example
 * validateURI('kairos://700468C5-2C80-4502-B60B-9A8C74044A35') // true (canonical)
 * validateURI('kairos://ai/rule/coding-rules/step/1') // true (canonical)
 * validateURI('kairos://ai/coding/rules/step/1') // true (hierarchical)
 * validateURI('invalid://bad/uri') // false
 */
export function validateURI(uri: string): boolean {
    return Object.values(URI_PATTERNS).some(pattern => pattern.test(uri));
}



/**
 * Parse kairos://UUID URI into components
 *
 * @param uri - kairos://UUID URI to parse
 * @returns Parsed UUID or null if invalid
 *
 * @example
 * parseKbURI('kairos://700468C5-2C80-4502-B60B-9A8C74044A35')
 * // Returns: {uuid: '700468C5-2C80-4502-B60B-9A8C74044A35'} (canonical unified format)
 */
export function parseKbURI(uri: string): {
    uuid: string;
} | null {
    const match = uri.match(/^kb:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if (match && match[1]) {
        return {
            uuid: match[1].toUpperCase(), // Normalize to uppercase for consistency
        };
    }

    return null;
}

/**
 * Parse kairos://{domain}/{type}/{task} or kairos://{domain}/{type}/{task}/step/{step} URI into components
 *
 * @param uri - kairos:// domain/type/task URI to parse
 * @returns Parsed components or null if invalid
 *
 * @example
 * parseDomainTypeTaskURI('kairos://docker/pattern/networking')
 * // Returns: {domain: 'docker', type: 'pattern', task: 'networking'}
 *
 * @example
 * parseDomainTypeTaskURI('kairos://ai/rule/coding-rules/step/3')
 * // Returns: {domain: 'ai', type: 'rule', task: 'coding-rules', step: 3}
 */
export function parseDomainTypeTaskURI(uri: string): {
    domain: string;
    type: string;
    task: string;
    step?: number;
} | null {
    // Try protocol step format first (longer pattern)
    const stepMatch = uri.match(/^kb:\/\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/step\/(\d+)$/);
    if (stepMatch && stepMatch[1] && stepMatch[2] && stepMatch[3] && stepMatch[4]) {
        return {
            domain: stepMatch[1],
            type: stepMatch[2],
            task: stepMatch[3],
            step: parseInt(stepMatch[4], 10)
        };
    }

    // Try domain/type/task format
    const domainMatch = uri.match(/^kb:\/\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (domainMatch && domainMatch[1] && domainMatch[2] && domainMatch[3]) {
        return {
            domain: domainMatch[1],
            type: domainMatch[2],
            task: domainMatch[3]
        };
    }

    return null;
}

/**
 * Parse hierarchical kairos://{path} or kairos://{path}/step/{step} URI into components
 *
 * @param uri - kairos:// hierarchical URI to parse
 * @returns Parsed components or null if invalid
 *
 * @example
 * parseHierarchicalURI('kairos://ai/coding/rules')
 * // Returns: {path: ['ai', 'coding', 'rules']}
 *
 * @example
 * parseHierarchicalURI('kairos://ai/coding/rules/step/3')
 * // Returns: {path: ['ai', 'coding', 'rules'], step: 3}
 */
export function parseHierarchicalURI(uri: string): {
    path: string[];
    step?: number;
} | null {
    // Try hierarchical step format first (longer pattern)
    const stepMatch = uri.match(/^kb:\/\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)\/step\/(\d+)$/);
    if (stepMatch && stepMatch[1] && stepMatch[2]) {
        const pathString = stepMatch[1];
        const path = pathString.split('/');
        const step = parseInt(stepMatch[2], 10);
        return { path, step };
    }

    // Try hierarchical format
    const pathMatch = uri.match(/^kb:\/\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/);
    if (pathMatch && pathMatch[1]) {
        const pathString = pathMatch[1];
        const path = pathString.split('/');
        return { path };
    }

    return null;
}


/**
 * Check if URI represents a template
 *
 * @param uri - URI to check
 * @returns true if URI is a template URI
 */
export function isTemplateURI(uri: string): boolean {
    return uri.startsWith('kairos://templates/');
}

/**
 * Check if URI represents a unified kairos://UUID resource (canonical format)
 *
 * @param uri - URI to check
 * @returns true if URI uses kairos:// scheme (canonical unified format)
 */
export function isKbURI(uri: string): boolean {
    return uri.startsWith('kairos://');
}
