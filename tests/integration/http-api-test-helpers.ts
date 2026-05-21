import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';

export const BASE_URL = getTestAuthBaseUrl();
export const API_BASE = `${BASE_URL}/api`;

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string>) }
  });
}
