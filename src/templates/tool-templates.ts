/**
 * Tool Template Generation
 *
 * Generates pre-filled JSON templates for KAIROS MCP tools.
 * Used by MCP resource templates to provide AI agents with correctly
 * formatted tool calls.
 */

export interface SearchTemplate {
    query: string;
    domain?: string;
    limit: number;
}

export interface StoreTemplate {
    description_short: string;
    description_full: string;
    domain: string;
    task: string;
    type: 'rule' | 'pattern' | 'snippet' | 'context';
    tags: string[];
    llm_model_id: string;
}


/**
 * Generate search template
 * @param domain - Optional domain filter
 */
export function generateSearchTemplate(domain?: string): SearchTemplate {
    const template: SearchTemplate = {
        query: "",
        limit: 15
    };

    if (domain && domain !== 'none') {
        template.domain = domain;
    }

    return template;
}

/**
 * Generate store template
 * @param type - The type of insight to store
 */
export function generateStoreTemplate(type: 'rule' | 'pattern' | 'snippet' | 'context' = 'context'): StoreTemplate {
    return {
        description_short: "",
        description_full: "",
        domain: "",
        task: "",
        type: type,
        tags: [],
        llm_model_id: ""
    };
}



/**
 * Store protocol template interface
 */
export interface StoreProtocolTemplate {
    domain: string;
    task: string;
    type: 'rule' | 'pattern' | 'snippet' | 'context';
    tags: string[];
    protocol?: {
        id?: string;
        title?: string;
        enforcement?: 'sequential' | 'flexible';
        skip_allowed?: boolean;
        total?: number;
    };
    steps: Record<string, {
        description_short: string;
        description_long: string;
    }>;
    llm_model_id: string;
}

/**
 * Generate store protocol template
 */
export function generateStoreProtocolTemplate(type: 'rule' | 'pattern' | 'snippet' | 'context' = 'rule'): StoreProtocolTemplate {
    const template: StoreProtocolTemplate = {
        domain: "",
        task: "",
        type,
        tags: [],
        protocol: {
            enforcement: 'sequential',
            skip_allowed: false
        },
        steps: {},
        llm_model_id: ""
    };

    return template;
}
/**
 * Get all available template types
 */
export function getAvailableTemplateTypes(): string[] {
    return ['search', 'store'];
}

/**
 * Get all available store types
 */
export function getAvailableStoreTypes(): Array<'rule' | 'pattern' | 'snippet' | 'context'> {
    return ['rule', 'pattern', 'snippet', 'context'];
}
