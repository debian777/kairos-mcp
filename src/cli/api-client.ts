/**
 * API Client for KAIROS REST API.
 * Returns canonical response shapes (no metadata wrapper).
 */

import { AuthRequiredError, isBrowserDisabled } from './auth-error.js';
import { getApiUrl } from './config.js';
import { getDefaultApiUrlFromFile, readConfig, writeConfig } from './config-file.js';
import { loginWithBrowser } from './commands/login.js';
import { jwtExpiresInSeconds, refreshAccessToken } from './oauth-refresh.js';
import { rewriteLoginUrlRedirectToApiBase } from './rewrite-login-url.js';
import { normalizeAndValidateApiBaseUrl, type SafeMarkdownUpload } from './upload-guards.js';
import type { ActivateOutput } from '../tools/activate_schema.js';
import type { ForwardOutput } from '../tools/forward_schema.js';
import type { RewardOutput } from '../tools/reward_schema.js';
import type { TrainOutput } from '../tools/train_schema.js';
import type { TuneOutput } from '../tools/tune_schema.js';
import type { ExportOutput } from '../tools/export_schema.js';
import type { DeleteOutput } from '../tools/delete_schema.js';

const PROACTIVE_REFRESH_SKEW_SEC = 60;

type SpacesOutput = {
    spaces: Array<{
        name: string;
        space_id: string;
        type: 'personal' | 'group' | 'app' | 'other';
        adapter_count: number;
        adapters?: Array<{ adapter_id: string; title: string; layer_count: number }>;
    }>;
};

export class ApiClient {
    private baseUrl: string;
    private openInBrowser: boolean;
    /** Coalesces concurrent refresh_token exchanges for this client instance. */
    private refreshInFlight: Promise<boolean> | null = null;

    constructor(baseUrl?: string, openInBrowser?: boolean) {
        // Precedence: explicit parameter (from global --url), then env, then config file, then default.
        const explicit = baseUrl?.trim();
        const configUrl = getDefaultApiUrlFromFile();
        const resolvedBaseUrl =
            explicit ||
            (process.env['KAIROS_API_URL'] || '').trim() ||
            configUrl ||
            getApiUrl();
        this.baseUrl = normalizeAndValidateApiBaseUrl(resolvedBaseUrl);
        this.openInBrowser = !isBrowserDisabled() && (openInBrowser !== false);
    }

    private async sleep(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private runRefreshWithSingleflight(refreshToken: string): Promise<boolean> {
        if (this.refreshInFlight) return this.refreshInFlight;
        const p = (async (): Promise<boolean> => {
            try {
                const result = await refreshAccessToken(this.baseUrl, refreshToken);
                if (!result) return false;
                const nextRefresh = result.refresh_token ?? refreshToken;
                await writeConfig({
                    apiUrl: this.baseUrl,
                    bearerToken: result.access_token,
                    refreshToken: nextRefresh,
                });
                return true;
            } catch {
                return false;
            } finally {
                this.refreshInFlight = null;
            }
        })();
        this.refreshInFlight = p;
        return p;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        isRetryAfterLogin = false,
        isRetryAfterRefresh = false,
        preLoginIfTokenMissing = true,
        rateLimitRetryCount = 0
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        let cfg = await readConfig(this.baseUrl);
        let bearer = cfg.bearerToken;
        if (cfg.refreshToken && bearer && !isRetryAfterRefresh) {
            const left = jwtExpiresInSeconds(bearer);
            if (left !== null && left <= PROACTIVE_REFRESH_SKEW_SEC) {
                await this.runRefreshWithSingleflight(cfg.refreshToken);
                cfg = await readConfig(this.baseUrl);
                bearer = cfg.bearerToken;
            }
        }
        if (!bearer && preLoginIfTokenMissing && this.openInBrowser && !isRetryAfterLogin) {
            const ok = await loginWithBrowser(this.baseUrl);
            if (ok) return this.request(endpoint, options, true, false, preLoginIfTokenMissing, rateLimitRetryCount);
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

        if (response.status === 429 && rateLimitRetryCount < 2) {
            const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? '1');
            const retryDelayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                ? retryAfterSeconds * 1000
                : 1000;
            await this.sleep(retryDelayMs);
            return this.request<T>(
                endpoint,
                options,
                isRetryAfterLogin,
                isRetryAfterRefresh,
                preLoginIfTokenMissing,
                rateLimitRetryCount + 1
            );
        }

        const data = await response.json().catch(() => {
            throw new Error(`Failed to parse response from ${url}`);
        });

        if (!response.ok) {
            const errorData = data as {
                message?: string;
                error?: string;
                login_url?: string;
                available_spaces?: unknown;
            };
            let msg = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            if (
                (errorData.error === 'SPACE_NOT_FOUND' || errorData.error === 'SPACE_READ_ONLY') &&
                Array.isArray(errorData.available_spaces)
            ) {
                const availableSpaces = errorData.available_spaces.filter((entry): entry is string => typeof entry === 'string');
                if (availableSpaces.length > 0) {
                    msg += `\nAvailable writable spaces: ${availableSpaces.join(', ')}`;
                }
            }
            if (response.status === 401) {
                const cfg401 = await readConfig(this.baseUrl);
                if (!isRetryAfterRefresh && cfg401.refreshToken) {
                    const refreshed = await this.runRefreshWithSingleflight(cfg401.refreshToken);
                    if (refreshed) {
                        return this.request<T>(
                            endpoint,
                            options,
                            isRetryAfterLogin,
                            true,
                            preLoginIfTokenMissing,
                            rateLimitRetryCount
                        );
                    }
                }
                if (this.openInBrowser && !isRetryAfterLogin) {
                    const ok = await loginWithBrowser(this.baseUrl);
                    if (ok) {
                        return this.request<T>(
                            endpoint,
                            options,
                            true,
                            false,
                            preLoginIfTokenMissing,
                            rateLimitRetryCount
                        );
                    }
                }
                if (errorData.login_url) {
                    const loginUrl = rewriteLoginUrlRedirectToApiBase(errorData.login_url, this.baseUrl);
                    throw new AuthRequiredError(`${msg}\n\nLog in at:\n${loginUrl}`, loginUrl);
                }
                throw new Error(msg);
            }
            throw new Error(msg);
        }

        return data as T;
    }
    async activate(query: string): Promise<ActivateOutput> {
        return this.request<ActivateOutput>('/api/activate', {
            method: 'POST',
            body: JSON.stringify({ query }),
        });
    }

    async forward(uri: string, solution?: unknown): Promise<ForwardOutput> {
        return this.request<ForwardOutput>('/api/forward', {
            method: 'POST',
            body: JSON.stringify({ uri, solution }),
        });
    }

    async train(
        markdown: SafeMarkdownUpload,
        options?: { llmModelId?: string; force?: boolean; space?: string },
        isRetryAfterLogin = false
    ): Promise<TrainOutput> {
        const headers: Record<string, string> = {
            'Content-Type': 'text/markdown',
        };

        if (options?.llmModelId) {
            headers['x-llm-model-id'] = options.llmModelId;
        }

        if (options?.force) {
            headers['x-force-update'] = 'true';
        }

        if (typeof options?.space === 'string' && options.space.trim().length > 0) {
            headers['x-space'] = options.space.trim();
        }

        return this.request<TrainOutput>(
            '/api/train/raw',
            {
                method: 'POST',
                headers,
                body: markdown,
            },
            isRetryAfterLogin,
            false,
            false
        );
    }

    async tune(
        uris: string[],
        opts?: {
            markdownDoc?: SafeMarkdownUpload[];
            updates?: Record<string, unknown>;
            space?: string;
        }
    ): Promise<TuneOutput> {
        const body: Record<string, unknown> = { uris };
        if (opts?.markdownDoc) body['markdown_doc'] = opts.markdownDoc;
        if (opts?.updates) body['updates'] = opts.updates;
        const sp = typeof opts?.space === 'string' ? opts.space.trim() : '';
        if (sp.length > 0) body['space'] = sp;
        return this.request<TuneOutput>('/api/tune', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /** JSON body train (space, source_adapter_uri fork, etc.); distinct from markdown POST /api/train/raw. */
    async trainJson(body: {
        llm_model_id: string;
        force_update?: boolean;
        space?: string;
        source_adapter_uri?: string;
        markdown_doc?: string;
        protocol_version?: string;
    }): Promise<TrainOutput> {
        return this.request<TrainOutput>('/api/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    async delete(uris: string[]): Promise<DeleteOutput> {
        return this.request<DeleteOutput>('/api/delete', {
            method: 'POST',
            body: JSON.stringify({ uris }),
        });
    }

    async spaces(options?: { include_adapter_titles?: boolean }): Promise<SpacesOutput> {
        const body: Record<string, unknown> = {};
        if (options?.include_adapter_titles === true) {
            body['include_adapter_titles'] = true;
        }
        return this.request<SpacesOutput>('/api/spaces', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async reward(
        uri: string,
        outcome: 'success' | 'failure',
        feedback: string,
        options?: { score?: number; rater?: string; rubricVersion?: string; llmModelId?: string }
    ): Promise<RewardOutput> {
        return this.request<RewardOutput>('/api/reward', {
            method: 'POST',
            body: JSON.stringify({
                uri,
                outcome,
                feedback,
                score: options?.score,
                rater: options?.rater,
                rubric_version: options?.rubricVersion,
                llm_model_id: options?.llmModelId,
            }),
        });
    }

    async export(
        uri: string,
        format: 'markdown' | 'trace_jsonl' | 'reward_jsonl' | 'sft_jsonl' | 'preference_jsonl' = 'markdown'
    ): Promise<ExportOutput> {
        return this.request<ExportOutput>('/api/export', {
            method: 'POST',
            body: JSON.stringify({ uri, format }),
        });
    }

}
