/**
 * Single source of truth for integration-test runtime capabilities.
 * Assertion code should use `TestHarness.scenario` / harness APIs — not raw `process.env` flags.
 */

export type ScenarioName = 'http-auth' | 'http-simple' | 'stdio-simple';

export type ScenarioConfig = {
  name: ScenarioName;
  transport: 'http' | 'stdio';
  authEnabled: boolean;
  supportsHttpApi: boolean;
  supportsBrowserLogin: boolean;
  supportsRawHealthEndpoint: boolean;
};

export const SCENARIOS: Record<ScenarioName, ScenarioConfig> = {
  'http-auth': {
    name: 'http-auth',
    transport: 'http',
    authEnabled: true,
    supportsHttpApi: true,
    supportsBrowserLogin: true,
    supportsRawHealthEndpoint: true
  },
  'http-simple': {
    name: 'http-simple',
    transport: 'http',
    authEnabled: false,
    supportsHttpApi: true,
    supportsBrowserLogin: false,
    supportsRawHealthEndpoint: true
  },
  'stdio-simple': {
    name: 'stdio-simple',
    transport: 'stdio',
    authEnabled: false,
    supportsHttpApi: false,
    supportsBrowserLogin: false,
    supportsRawHealthEndpoint: false
  }
};
