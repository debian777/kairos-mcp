/**
 * Jest stub for the `uuid` package (see jest.config.js moduleNameMapper).
 * Named exports match `import { v4, v5 } from 'uuid'` usage in src/.
 */
export function v4(): string {
  return '00000000-0000-0000-0000-000000000004';
}

export function v5(name: string, namespace: string): string {
  void name;
  void namespace;
  return '00000000-0000-0000-0000-000000000005';
}
