/**
 * API Client for KAIROS REST API
 */

import { AuthRequiredError } from './auth-error.js';
import { getApiUrl } from './config.js';
import { readConfig } from './config-file.js';
import { loginWithBrowser } from './commands/login.js';

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
    private openInBrowser: boolean;

    constructor(baseUrl?: string, openInBrowser?: boolean) {
        // Precedence: env, then parameter, then config file, then default. openInBrowser true = auto-login on 401 or no token
        const config = readConfig(); // default env for baseUrl resolution
        this.baseUrl = process.env['KAIROS_API_URL'] || baseUrl || config.apiUrl || getApiUrl();
        this.baseUrl = this.baseUrl.replace(/\/$/, '');
        const noAutoLogin = process.env['KAIROS_CLI_NO_AUTO_LOGIN'] === '1' || process.env['KAIROS_CLI_NO_AUTO_LOGIN'] === 'true';
        this.openInBrowser = !noAutoLogin && (openInBrowser === true);
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        isRetryAfterLogin = false
    ): Promise<ApiResponse<T>> {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        let bearer = readConfig(this.baseUrl).bearerToken;
        if (!bearer && this.openInBrowser && !isRetryAfterLogin) {
            const ok = await loginWithBrowser(this.baseUrl);
            if (ok) return this.request(endpoint, options, true);
        }
        if (bearer) {
            defaultHeaders['Authorization'] = `Bearer ${bearer}`;
        }

        const requestTimeoutMs = 15_000;
        const ac = new AbortController();
        const timeoutId = setTimeout(() => ac.abort(), requestTimeoutMs);
        let response: Response;
        try {
            response = await fetch(url, {
                ...options,
                signal: ac.signal,
                headers: {
                    ...defaultHeaders,
                    ...(options.headers as Record<string, string> || {}),
                },
            });
        } catch (err) {
            clearTimeout(timeoutId);
            if (err instanceof Error && err.name === 'AbortError') {
                throw new Error(`Request to ${url} timed out after ${requestTimeoutMs / 1000}s`);
            }
            throw err;
        }
        clearTimeout(timeoutId);

        const data = await response.json().catch(() => {
            throw new Error(`Failed to parse response from ${url}`);
        }) as ApiResponse<T>;

        if (!response.ok) {
            const errorData = data as { message?: string; error?: string; login_url?: string };
            const msg = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            if (response.status === 401 && errorData.login_url) {
                // On 401 with --open: run same PKCE flow as "kairos login", then retry once
                if (this.openInBrowser && !isRetryAfterLogin) {
                    const ok = await loginWithBrowser(this.baseUrl);
                    if (ok) return this.request(endpoint, options, true);
                }
                throw new AuthRequiredError(
                    `${msg}\n\nLog in at:\n${errorData.login_url}`,
                    errorData.login_url
                );
            }
            throw new Error(msg);
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

    async mint(
        markdown: string,
        options?: { llmModelId?: string; force?: boolean },
        isRetryAfterLogin = false
    ): Promise<ApiResponse> {
        const url = `${this.baseUrl}/api/kairos_mint/raw`;
        const headers: Record<string, string> = {
            'Content-Type': 'text/markdown',
        };
        const bearer = readConfig(this.baseUrl).bearerToken;
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
            const errorData = data as { message?: string; error?: string; login_url?: string };
            const msg = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            if (response.status === 401 && errorData.login_url) {
                if (this.openInBrowser && !isRetryAfterLogin) {
                    const ok = await loginWithBrowser(this.baseUrl);
                    if (ok) return this.mint(markdown, options, true);
                }
                throw new AuthRequiredError(
                    `${msg}\n\nLog in at:\n${errorData.login_url}`,
                    errorData.login_url
                );
            }
            throw new Error(msg);
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

