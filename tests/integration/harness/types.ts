import type { ScenarioConfig } from './scenario.js';

export interface TestHarness {
  readonly scenario: ScenarioConfig;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}
