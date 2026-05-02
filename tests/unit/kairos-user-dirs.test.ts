import { afterEach, describe, expect, it } from '@jest/globals';
import { join } from 'node:path';
import {
  getKairosConfigDir,
  getKairosSkillInstallDirForSlug,
  getKairosSkillsInstallBaseDir
} from '../../src/utils/kairos-user-dirs.js';

describe('kairos-user-dirs', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('places skills install base under config dir', () => {
    process.env['XDG_CONFIG_HOME'] = '/xdg';
    expect(getKairosSkillsInstallBaseDir()).toBe(join('/xdg', 'kairos', 'skills'));
    expect(getKairosSkillInstallDirForSlug('my-skill')).toBe(join('/xdg', 'kairos', 'skills', 'my-skill'));
  });

  it('sanitizes slug path segments for install dir', () => {
    process.env['XDG_CONFIG_HOME'] = '/x';
    expect(getKairosSkillInstallDirForSlug('a/b')).toBe(join('/x', 'kairos', 'skills', 'a_b'));
  });

  it('getKairosConfigDir matches skills base parent', () => {
    process.env['XDG_CONFIG_HOME'] = '/cfg';
    const base = getKairosSkillsInstallBaseDir();
    expect(base.startsWith(getKairosConfigDir())).toBe(true);
    expect(base.endsWith(join('kairos', 'skills'))).toBe(true);
  });
});
