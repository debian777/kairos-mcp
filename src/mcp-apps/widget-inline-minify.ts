const trimTemplateLines = (source: string): string =>
  source
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('');

export const minifyInlineWidgetScript = (source: string): string => trimTemplateLines(source);

export const minifyInlineWidgetCss = (source: string): string =>
  source
    .trim()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

export const minifyInlineWidgetHtml = (source: string): string => source.trim().replace(/>\s+</g, '><');
