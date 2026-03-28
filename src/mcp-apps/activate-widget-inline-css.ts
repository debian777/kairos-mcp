/**
 * Activate MCP App styles: shared chrome ({@link ./mcp-widget-chrome-inline-css.ts}) + choice list.
 */
import { MCP_WIDGET_CHROME_INLINE_CSS } from './mcp-widget-chrome-inline-css.js';

const ACTIVATE_WIDGET_SPECIFIC_INLINE_CSS = `
    .waiting { opacity: 0.9; font-style: italic; color: var(--color-text-muted); }
    .choices-list { list-style: none; margin: 0; padding: 0; }
    .choice {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 8px 10px;
      margin-bottom: 8px;
      background: var(--color-surface);
    }
    .choice-row { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; margin-bottom: 4px; }
    .pill {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--color-border);
    }
    .pill[data-role="match"] {
      background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface-elevated));
      border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
      color: var(--color-success);
    }
    .pill[data-role="refine"] {
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-elevated));
      border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
      color: var(--color-accent);
    }
    .pill[data-role="create"] {
      background: color-mix(in srgb, var(--color-warning) 14%, var(--color-surface-elevated));
      border-color: color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
      color: var(--color-warning);
    }
    .choice-title { font-weight: 600; flex: 1; min-width: 0; color: var(--color-text-heading); }
    .choice-score { font-size: 11px; color: var(--color-text-muted); }
    .sub { font-size: 12px; color: var(--color-text-muted); margin: 2px 0; word-break: break-word; }
    .cap-note { font-size: 12px; font-style: italic; color: var(--color-text-muted); margin-top: 8px; }
`.trim();

export const ACTIVATE_WIDGET_INLINE_CSS = `${MCP_WIDGET_CHROME_INLINE_CSS}\n${ACTIVATE_WIDGET_SPECIFIC_INLINE_CSS}`;
