/**
 * Test helpers that print the raw MCP/app response on assertion failures.
 */

export function withRawOnFail(raw, assertions, header) {
  try {
    assertions();
  } catch (err) {
    try {
      const h = header || '[RAW TEST OBJECT]';
      // If the caller provided { call, result }, print them separately for readability
      if (raw && typeof raw === 'object' && 'call' in raw && 'result' in raw) {
        console.debug(`${h} [REQUEST]:`, JSON.stringify(raw.call, null, 2));
        console.debug(`${h} [RESPONSE]:`, JSON.stringify(raw.result, null, 2));
      } else {
        console.debug(`${h}:`, JSON.stringify(raw, null, 2));
      }
    } catch {
      const h = header || '[RAW TEST OBJECT]';
      if (raw && typeof raw === 'object' && 'call' in raw && 'result' in raw) {
        console.debug(`${h} [REQUEST]:`, String(raw.call));
        console.debug(`${h} [RESPONSE]:`, String(raw.result));
      } else {
        console.debug(`${h}:`, String(raw));
      }
    }
    throw err;
  }
}

/**
 * Parses standard MCP text response into JSON with raw logging on failure.
 */
export function parseMcpJson(result, header) {
  try {
    if (!result || !Array.isArray(result.content) || result.content.length === 0) {
      throw new Error('Invalid MCP result: missing content');
    }
    const entry = result.content[0];
    if (!entry || entry.type !== 'text') {
      throw new Error(`Unsupported content type: ${entry?.type}`);
    }
    return JSON.parse(entry.text);
  } catch (err) {
    try {
      const h = header || 'MCP raw result';
      console.debug(`${h} [RESPONSE]:`, JSON.stringify(result, null, 2));
    } catch {
      const h = header || 'MCP raw result';
      console.debug(`${h} [RESPONSE]:`, String(result));
    }
    throw err;
  }
}
