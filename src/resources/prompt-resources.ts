import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { getPrompts, getPrompt } from './embedded-mcp-resources.js';
import { logger } from '../utils/logger.js';

type PromptOverride = {
  title?: string;
  description?: string;
  resultDescription?: string;
};

const promptOverrides: Record<string, PromptOverride> = {
  'contextual-prompt': {
    title: 'KAIROS Core Execution Engine',
    description: 'Required execution policy for KAIROS protocol runs',
    resultDescription: 'Required execution policy for KAIROS protocol runs'
  }
};

/**
 * Register all prompts from embedded-mcp-resources
 */
export function registerPromptResources(server: any) {
  logger.info('Registering prompts dynamically from embedded resources');

  const prompts = getPrompts();

  for (const [key, text] of Object.entries(prompts)) {
    const override = promptOverrides[key] ?? {};
    const title =
      override.title || key.replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const description = override.description || `Prompt: ${title}`;
    const resultDescription = override.resultDescription || description;

    server.registerPrompt(
      key,
      {
        title,
        description
      },
      async (): Promise<GetPromptResult> => {
        const promptText = getPrompt(key) || text;
        const result: GetPromptResult = {
          description: resultDescription,
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

