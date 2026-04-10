import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { writeJson } from '../output.js';
import { getResolvedApiBaseFromProgram } from '../resolve-api-base.js';

/**
 * spaces command
 */
export function spacesCommand(program: Command): void {
  program
    .command('spaces')
    .description('List available spaces and adapter counts')
    .option(
      '--include-adapter-titles',
      'Include per-space adapter titles and layer counts'
    )
    .action(async (options: { includeAdapterTitles?: boolean }) => {
      try {
        const client = new ApiClient(getResolvedApiBaseFromProgram(program));
        const response = await client.spaces({
          include_adapter_titles: Boolean(options.includeAdapterTitles)
        });
        writeJson(response);
      } catch (error) {
        handleApiError(error, !isBrowserDisabled());
      }
    });
}
