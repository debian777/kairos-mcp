import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { getPrompts, getPrompt } from './embedded-mcp-resources.js';
import { logger } from '../utils/logger.js';

/**
 * Register all prompts from embedded-mcp-resources
 */
export function registerPromptResources(server: any) {
  logger.info('Registering prompts dynamically from embedded resources');

  const prompts = getPrompts();

  for (const [key, text] of Object.entries(prompts)) {
    const title = key.replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const description = `Prompt: ${title}`;

    server.registerPrompt(
      key,
      {
        title,
        description
      },
      async (): Promise<GetPromptResult> => {
        const promptText = getPrompt(key) || text;
        const result: GetPromptResult = {
          description,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: promptText
              }
            }
          ]
        };

        return result;
      }
    );
  }
}

