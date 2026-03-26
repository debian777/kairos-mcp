const MEMORY_URI_REGEX = /kairos:\/\/mem\/[0-9a-f-]{36}/gi;

export function rewriteTuneMessage(message: string, layerUri: string): string {
  return message
    .replace(/\bmemory\b/gi, (match) => (match[0] === 'M' ? 'Adapter layer' : 'adapter layer'))
    .replace(MEMORY_URI_REGEX, layerUri);
}

export function buildTuneResultMessage(
  entry: { status: 'updated' | 'error'; message: string },
  layerUri: string
): string {
  if (entry.status === 'updated') {
    return `Adapter layer ${layerUri} updated successfully`;
  }

  return rewriteTuneMessage(entry.message, layerUri);
}
