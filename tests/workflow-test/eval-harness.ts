export interface EvalCheck {
  name: string;
  passed: boolean;
  details?: unknown;
}

export interface EvalCaseResult {
  id: string;
  checks: EvalCheck[];
  metrics: Record<string, number>;
  artifacts?: Record<string, unknown>;
}

export interface EvalSuiteResult {
  passed: boolean;
  results: EvalCaseResult[];
}

export async function runEvalSuite(cases: Array<{
  id: string;
  run: () => Promise<Omit<EvalCaseResult, 'id'>>;
}>): Promise<EvalSuiteResult> {
  const results: EvalCaseResult[] = [];
  for (const testCase of cases) {
    const result = await testCase.run();
    results.push({
      id: testCase.id,
      checks: result.checks,
      metrics: result.metrics,
      ...(result.artifacts ? { artifacts: result.artifacts } : {})
    });
  }
  return {
    passed: results.every((result) => result.checks.every((check) => check.passed)),
    results
  };
}

export function getEvalFailures(suite: EvalSuiteResult): Array<{
  caseId: string;
  check: string;
  details?: unknown;
}> {
  return suite.results.flatMap((result) =>
    result.checks
      .filter((check) => !check.passed)
      .map((check) => ({
        caseId: result.id,
        check: check.name,
        ...(check.details !== undefined ? { details: check.details } : {})
      }))
  );
}
