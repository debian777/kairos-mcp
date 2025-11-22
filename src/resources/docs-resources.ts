import { getResource, getResources } from './embedded-mcp-resources.js';
import { logger } from '../utils/logger.js';

function mdOrFallback(uri: any, text?: string, notFound: string = 'Document not found') {
  return {
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: text || `# ${notFound}` }]
  };
}

export function registerDocsResources(server: any) {
  logger.info('Registering docs resources dynamically from embedded resources (excluding templates)');

  const resources = getResources();
  const toTitle = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

  // Iterate through subdirectories (doc, mem, etc.)
  for (const [subdir, subdirContent] of Object.entries(resources)) {
    // Each subdirectory becomes a prefix: kairos://{subdir}
    const prefix = `kairos://${subdir}`;

    // Iterate through files in this subdirectory
    if (typeof subdirContent === 'object' && subdirContent !== null) {
      for (const [filename, content] of Object.entries(subdirContent)) {
        if (typeof content === 'string') {
          const uri = `${prefix}/${filename}`;
          const name = toTitle(filename);
          const description = `Documentation for ${name}`;

          server.registerResource(
            `${subdir}-${filename}`,
            uri,
            { name, description, mimeType: 'text/markdown' },
            (uriObj: any) => {
              const resourceContent = getResource(`${subdir}.${filename}`);
              return mdOrFallback(uriObj, resourceContent);
            }
          );
        }
      }
    }
  }

  // Tools docs are not registered as resources to keep resources/list lean.
}
