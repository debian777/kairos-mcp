/**
 * Restrict outbound CLI URLs to http(s) without embedded credentials, query, or fragment.
 * Used before fetch() for API base and IdP endpoints from metadata.
 * (Unlike normalizeAndValidateApiBaseUrl in upload-guards.ts, this does not apply TRUSTED_API_HOSTS.)
 */

/** @returns Normalized absolute URL string (no trailing slash), or null if invalid. */
export function tryNormalizeHttpUrlForFetch(raw: string | undefined | null): string | null {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    let u: URL;
    try {
        u = new URL(trimmed);
    } catch {
        return null;
    }
    if (u.username !== '' || u.password !== '') return null;
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.search !== '' || u.hash !== '') return null;
    return u.href.replace(/\/$/, '');
}
