import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';
import { MOCK_REVIEW_EVIDENCE } from '../utils/mock-review-evidence.js';

export const BASE_URL = getTestAuthBaseUrl();
export const API_BASE = `${BASE_URL}/api`;

/** Encoded review_evidence query param for /api/train/raw requests. */
export const REVIEW_EVIDENCE_PARAM = `review_evidence=${encodeURIComponent(JSON.stringify(MOCK_REVIEW_EVIDENCE))}`;

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string>) }
  });
}
