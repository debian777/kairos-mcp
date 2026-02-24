/**
 * Deterministic uuid mock for unit tests (referenced by jest.config.js moduleNameMapper).
 */
const fixed = '00000000-0000-0000-0000-000000000000';
export const v4 = () => fixed;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- v5(name, namespace) signature for compatibility
export const v5 = (_name: string, _namespace: string | Uint8Array) => fixed;
