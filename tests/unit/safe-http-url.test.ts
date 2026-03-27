import { describe, expect, it } from '@jest/globals';
import { tryNormalizeHttpUrlForFetch } from '../../src/cli/safe-http-url.js';

describe('safe-http-url', () => {
    it('accepts http and https URLs and strips trailing slash', () => {
        expect(tryNormalizeHttpUrlForFetch('https://api.example.com/')).toBe('https://api.example.com');
        expect(tryNormalizeHttpUrlForFetch('http://localhost:3300')).toBe('http://localhost:3300');
    });

    it('rejects non-http(s) schemes, credentials, and query or fragment', () => {
        expect(tryNormalizeHttpUrlForFetch('file:///etc/passwd')).toBeNull();
        expect(tryNormalizeHttpUrlForFetch('javascript:alert(1)')).toBeNull();
        expect(tryNormalizeHttpUrlForFetch('http://user:pass@localhost:1')).toBeNull();
        expect(tryNormalizeHttpUrlForFetch('http://localhost:1/?q=1')).toBeNull();
        expect(tryNormalizeHttpUrlForFetch('http://localhost:1/#frag')).toBeNull();
        expect(tryNormalizeHttpUrlForFetch('')).toBeNull();
        expect(tryNormalizeHttpUrlForFetch('   ')).toBeNull();
    });
});
