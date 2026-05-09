let patched = false;

/**
 * Qdrant client currently injects `dispatcher` into fetch init.
 * On Node 25, that dispatcher from qdrant's undici v6 is not compatible
 * with the runtime fetch internals and causes `InvalidArgumentError: invalid onError method`.
 * Strip only that field and preserve all other init options.
 */
export function installQdrantFetchCompatibility(): void {
  if (patched) return;
  if (typeof globalThis.fetch !== 'function') return;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    if (init && typeof init === 'object' && 'dispatcher' in init) {
      const { dispatcher: _dispatcher, ...rest } = init as RequestInit & { dispatcher?: unknown };
      return nativeFetch(input, rest);
    }
    return nativeFetch(input, init);
  }) as typeof fetch;

  patched = true;
}
