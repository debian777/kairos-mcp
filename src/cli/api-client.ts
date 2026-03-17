/**
 * API Client for KAIROS REST API.
 * Returns canonical response shapes (no metadata wrapper).
 */

import { AuthRequiredError } from './auth-error.js';
import { getApiUrl } from './config.js';
import { getDefaultApiUrlFromFile, readConfig } from './config-file.js';
import { loginWithBrowser } from './commands/login.js';
import type { SearchOutput } from '../tools/kairos_search_schema.js';
import type { BeginOutput } from '../tools/kairos_begin.js';
import type { NextOutput } from '../tools/kairos_next.js';
import type { AttestOutput } from '../tools/kairos_attest_schema.js';
import type { MintOutput } from '../tools/kairos_mint_schema.js';
import type { UpdateOutput } from '../tools/kairos_update_schema.js';
import type { DeleteOutput } from '../tools/kairos_delete_schema.js';

export class ApiClient {
    private baseUrl: string;
    private openInBrowser: boolean;

    constructor(baseUrl?: string, openInBrowser?: boolean) {
        // Precedence: env, then parameter, then config file (sync URL only), then default. openInBrowser true = auto-login on 401 or no token
        const configUrl = getDefaultApiUrlFromFile();
        this.baseUrl = process.env['KAIROS_API_URL'] || baseUrl || configUrl || getApiUrl();
        this.baseUrl = this.baseUrl.replace(/\/$/, '');
        const noAutoLogin = process.env['KAIROS_CLI_NO_AUTO_LOGIN'] === '1' || process.env['KAIROS_CLI_NO_AUTO_LOGIN'] === 'true';
        this.openInBrowser = !noAutoLogin && (openInBrowser !== false);
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        isRetryAfterLogin = false
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        let bearer = (await readConfig(this.baseUrl)).bearerToken;
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
        });

        if (!response.ok) {
            const errorData = data as { message?: string; error?: string; login_url?: string };
            const msg = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            if (response.status === 401) {
                if (this.openInBrowser && !isRetryAfterLogin) {
                    const ok = await loginWithBrowser(this.baseUrl);
                    if (ok) return this.request(endpoint, options, true);
                }
                if (errorData.login_url) {
                    throw new AuthRequiredError(
                        `${msg}\n\nLog in at:\n${errorData.login_url}`,
                        errorData.login_url
                    );
                }
                throw new Error('Authentication required. Run `kairos login` to sign in.');
            }
            throw new Error(msg);
        }

        return data as T;
    }
    async search(query: string): Promise<SearchOutput> {
        return this.request<SearchOutput>('/api/kairos_search', {
            method: 'POST',
            body: JSON.stringify({ query }),
        });
    }

    async begin(uri: string): Promise<BeginOutput> {
        return this.request<BeginOutput>('/api/kairos_begin', {
            method: 'POST',
            body: JSON.stringify({ uri }),
        });
    }

    async next(uri: string, solution?: unknown): Promise<NextOutput> {
        return this.request<NextOutput>('/api/kairos_next', {
            method: 'POST',
            body: JSON.stringify({ uri, solution }),
        });
    }

    async mint(
        markdown: string,
        options?: { llmModelId?: string; force?: boolean },
        isRetryAfterLogin = false
    ): Promise<MintOutput> {
        const url = `${this.baseUrl}/api/kairos_mint/raw`;
        const headers: Record<string, string> = {
            'Content-Type': 'text/markdown',
        };
        const bearer = (await readConfig(this.baseUrl)).bearerToken;
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
        }) as MintOutput & { message?: string; error?: string; login_url?: string };

        if (!response.ok) {
            const msg = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
            if (response.status === 401) {
                if (this.openInBrowser && !isRetryAfterLogin) {
                    const ok = await loginWithBrowser(this.baseUrl);
                    if (ok) return this.mint(markdown, options, true);
                }
                if (data.login_url) {
                    throw new AuthRequiredError(
                        `${msg}\n\nLog in at:\n${data.login_url}`,
                        data.login_url
                    );
                }
                throw new Error('Authentication required. Run `kairos login` to sign in.');
            }
            throw new Error(msg);
        }

        return data as MintOutput;
    }

    async update(uris: string[], markdownDoc?: string[], updates?: Record<string, unknown>): Promise<UpdateOutput> {
        return this.request<UpdateOutput>('/api/kairos_update', {
            method: 'POST',
            body: JSON.stringify({ uris, markdown_doc: markdownDoc, updates }),
        });
    }

    async delete(uris: string[]): Promise<DeleteOutput> {
        return this.request<DeleteOutput>('/api/kairos_delete', {
            method: 'POST',
            body: JSON.stringify({ uris }),
        });
    }

    async attest(
        uri: string,
        outcome: 'success' | 'failure',
        message: string,
        options?: { qualityBonus?: number; llmModelId?: string }
    ): Promise<AttestOutput> {
        return this.request<AttestOutput>('/api/kairos_attest', {
            method: 'POST',
            body: JSON.stringify({
                uri,
                outcome,
                message,
                quality_bonus: options?.qualityBonus ?? 0,
                llm_model_id: options?.llmModelId,
            }),
        });
    }
}
