'use strict';

/**
 * Jest reporter: append a Vitest-style block to GITHUB_STEP_SUMMARY (GitHub Actions only).
 */
const fs = require('fs');

class JestGitHubSummaryReporter {
  onRunComplete(_contexts, results) {
    const path = process.env.GITHUB_STEP_SUMMARY;
    if (!path || !results) {
      return;
    }

    const passedSuites = results.numPassedTestSuites ?? 0;
    const failedSuites = results.numFailedTestSuites ?? 0;
    const pendingSuites = results.numPendingTestSuites ?? 0;
    const totalSuites = results.numTotalTestSuites ?? passedSuites + failedSuites + pendingSuites;

    const passedTests = results.numPassedTests ?? 0;
    const failedTests = results.numFailedTests ?? 0;
    const pendingTests = results.numPendingTests ?? 0;
    const totalTests = results.numTotalTests ?? passedTests + failedTests + pendingTests;

    // Do not use results.success here: Jest sets it only *after* onRunComplete
    // (@jest/core schedules onRunComplete before assigning aggregatedResults.success),
    // so success is still false during this hook even when every test passed.
    const runtimeErrorSuites = results.numRuntimeErrorTestSuites ?? 0;
    const snapshotFailed = results.snapshot?.failure === true;
    const runExecError = results.runExecError != null;
    const interrupted = results.wasInterrupted === true;
    const ok =
      failedSuites === 0 &&
      failedTests === 0 &&
      runtimeErrorSuites === 0 &&
      !snapshotFailed &&
      !runExecError &&
      !interrupted;
    const suiteIcon = ok ? '✅' : '❌';
    const testIcon = ok ? '✅' : '❌';

    const suiteParts = [`${passedSuites} passed`];
    if (failedSuites) suiteParts.push(`${failedSuites} failed`);
    if (pendingSuites) suiteParts.push(`${pendingSuites} pending`);

    const testParts = [`${passedTests} passed`];
    if (failedTests) testParts.push(`${failedTests} failed`);
    if (pendingTests) testParts.push(`${pendingTests} skipped`);

    const block =
      `## Jest integration tests\n\n` +
      `### Summary\n\n` +
      `- ${suiteIcon} **Test files** — ${suiteParts.join(', ')} · ${totalSuites} total\n` +
      `- ${testIcon} **Tests** — ${testParts.join(', ')} · ${totalTests} total\n\n`;

    try {
      fs.appendFileSync(path, block, 'utf8');
    } catch {
      // ignore summary write errors
    }
  }
}

module.exports = JestGitHubSummaryReporter;
