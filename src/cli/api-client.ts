/**
 * API Client for KAIROS REST API
 */

import { getApiUrl } from './config.js';

export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
    metadata?: {
        duration_ms?: number;
        cached?: boolean;
    };
}

export class ApiClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        // Check environment variable first (set by CLI hook), then parameter, then default
        this.baseUrl = process.env['KAIROS_API_URL'] || baseUrl || getApiUrl();
        // Remove trailing slash
        this.baseUrl = this.baseUrl.replace(/\/$/, '');
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        const bearer = process.env['KAIROS_BEARER_TOKEN'];
        if (bearer) {
            defaultHeaders['Authorization'] = `Bearer ${bearer}`;
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers as Record<string, string> || {}),
            },
        });

        const data = await response.json().catch(() => {
            throw new Error(`Failed to parse response from ${url}`);
        }) as ApiResponse<T>;

        if (!response.ok) {
            const errorData = data as any;
            throw new Error(
                errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`
            );
        }

        return data;
    }

    async search(query: string): Promise<ApiResponse> {
        return this.request('/api/kairos_search', {
            method: 'POST',
            body: JSON.stringify({ query }),
        });
    }

    async begin(uri: string): Promise<ApiResponse> {
        return this.request('/api/kairos_begin', {
            method: 'POST',
            body: JSON.stringify({ uri }),
        });
    }

    async next(uri: string, solution?: any): Promise<ApiResponse> {
        return this.request('/api/kairos_next', {
            method: 'POST',
            body: JSON.stringify({ uri, solution }),
        });
    }

    async mint(markdown: string, options?: { llmModelId?: string; force?: boolean }): Promise<ApiResponse> {
        const url = `${this.baseUrl}/api/kairos_mint/raw`;
        const headers: Record<string, string> = {
            'Content-Type': 'text/markdown',
        };
        const bearer = process.env['KAIROS_BEARER_TOKEN'];
        if (bearer) {
            headers['Authorization'] = `Bearer ${bearer}`;
        }

        if (options?.llmModelId) {
            headers['x-llm-model-id'] = options.llmModelId;
        }

        if (options?.force) {
            headers['x-force-update'] = 'true';
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: markdown,
        });

        const data = await response.json().catch(() => {
            throw new Error(`Failed to parse response from ${url}`);
        }) as ApiResponse;

        if (!response.ok) {
            const errorData = data as any;
            throw new Error(
                errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`
            );
        }

        return data;
    }

    async update(uris: string[], markdownDoc?: string[], updates?: Record<string, any>): Promise<ApiResponse> {
        return this.request('/api/kairos_update', {
            method: 'POST',
            body: JSON.stringify({ uris, markdown_doc: markdownDoc, updates }),
        });
    }

    async delete(uris: string[]): Promise<ApiResponse> {
        return this.request('/api/kairos_delete', {
            method: 'POST',
            body: JSON.stringify({ uris }),
        });
    }

    async attest(
        uri: string,
        outcome: 'success' | 'failure',
        message: string,
        options?: { qualityBonus?: number; llmModelId?: string }
    ): Promise<ApiResponse> {
        return this.request('/api/kairos_attest', {
            method: 'POST',
            body: JSON.stringify({
                uri,
                outcome,
                message,
                quality_bonus: options?.qualityBonus || 0,
                llm_model_id: options?.llmModelId,
            }),
        });
    }
}

