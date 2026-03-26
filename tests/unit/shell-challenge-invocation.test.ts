/**
 * Unit tests for shell challenge argv construction (interpreter, flags, args).
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildShellChallengeArgv,
  formatShellInvocationForDisplay,
  formatShellChallengeInvocationSummary,
  pickShellChallengeFields
} from '../../src/tools/shell-challenge-invocation.js';

describe('buildShellChallengeArgv', () => {
  test('default bash -c without args', () => {
    expect(buildShellChallengeArgv({ cmd: 'echo hi' })).toEqual(['bash', '-c', 'echo hi']);
  });

  test('default bash -c with args uses --', () => {
    expect(buildShellChallengeArgv({ cmd: 'echo "$1"', args: ['a', 'b'] })).toEqual([
      'bash',
      '-c',
      'echo "$1"',
      '--',
      'a',
      'b'
    ]);
  });

  test('explicit bash same as default bash -c path', () => {
    expect(buildShellChallengeArgv({ interpreter: 'bash', cmd: 'true' })).toEqual(['bash', '-c', 'true']);
  });

  test('python3 injects -c', () => {
    expect(buildShellChallengeArgv({ interpreter: 'python3', cmd: 'print(1)' })).toEqual([
      'python3',
      '-c',
      'print(1)'
    ]);
  });

  test('perl -ne does not add extra -e', () => {
    expect(
      buildShellChallengeArgv({
        interpreter: 'perl',
        flags: ['-00', '-ne'],
        cmd: 'print',
        args: ['f.md']
      })
    ).toEqual(['perl', '-00', '-ne', 'print', 'f.md']);
  });

  test('node injects -e', () => {
    expect(buildShellChallengeArgv({ interpreter: 'node', cmd: 'process.exit(0)' })).toEqual([
      'node',
      '-e',
      'process.exit(0)'
    ]);
  });

  test('terraform uses other style (no auto code flag)', () => {
    expect(
      buildShellChallengeArgv({
        interpreter: 'terraform',
        flags: ['validate'],
        cmd: '',
        args: []
      })
    ).toEqual(['terraform', 'validate']);
  });

  test('formatShellChallengeInvocationSummary joins argv', () => {
    const s = formatShellChallengeInvocationSummary({ cmd: 'echo', args: ['a b'] });
    expect(s).toContain('bash');
    expect(s).toContain('echo');
    expect(s).toContain("'a b'");
  });

  test('formatShellInvocationForDisplay quotes spaces', () => {
    expect(formatShellInvocationForDisplay(['bash', '-c', 'echo hi'])).toMatch(/bash -c/);
  });
});

describe('pickShellChallengeFields', () => {
  test('omits empty optional keys (exactOptionalPropertyTypes-safe)', () => {
    const picked = pickShellChallengeFields({
      cmd: 'true',
      interpreter: undefined,
      flags: undefined,
      args: undefined,
      workdir: undefined
    });
    expect(Object.keys(picked).sort()).toEqual(['cmd']);
  });

  test('trims interpreter and workdir; keeps flags/args when explicitly set', () => {
    const picked = pickShellChallengeFields({
      cmd: 'x',
      interpreter: '  perl  ',
      flags: [],
      args: ['a'],
      workdir: ' /tmp/w '
    });
    expect(picked).toEqual({
      cmd: 'x',
      interpreter: 'perl',
      flags: [],
      args: ['a'],
      workdir: '/tmp/w'
    });
  });

  test('round-trips through argv like loose object would', () => {
    const argv = buildShellChallengeArgv(
      pickShellChallengeFields({
        cmd: 'print(0)',
        interpreter: 'python3',
        flags: undefined,
        args: undefined,
        workdir: undefined
      })
    );
    expect(argv).toEqual(['python3', '-c', 'print(0)']);
  });
});
