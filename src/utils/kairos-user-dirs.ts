/**
 * Cross-OS Kairos user directory layout (shared by CLI config and runtime defaults).
 */
import { homedir, platform } from 'os';
import { join } from 'path';

const CONFIG_DIR_NAME = 'kairos';

/**
 * Directory for Kairos CLI/MCP JSON config (`config.json`), same rules as the CLI.
 * - Windows: `%APPDATA%\kairos`
 * - Unix: `$XDG_CONFIG_HOME/kairos` or `~/.config/kairos`
 */
export function getKairosConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (platform() === 'win32') {
    const appData = env['APPDATA'] || join(homedir(), 'AppData', 'Roaming');
    return join(appData, CONFIG_DIR_NAME);
  }
  const base = env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
  return join(base, CONFIG_DIR_NAME);
}
