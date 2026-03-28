/** Forward-only styles; shared chrome in {@link ./mcp-widget-chrome-inline-css.ts}. */
import { MCP_WIDGET_CHROME_INLINE_CSS } from './mcp-widget-chrome-inline-css.js';

const FORWARD_WIDGET_SPECIFIC_INLINE_CSS = `
    #out.step-panel {
      box-shadow: inset 3px 0 0 0 color-mix(in srgb, var(--color-primary) 72%, transparent);
    }
    #out .step-running {
      margin: 0;
      line-height: 1.45;
      font-size: clamp(0.875rem, 2.2vw, 0.9375rem);
    }
    #out .step-running-label {
      display: inline;
      font-weight: 600;
      font-size: 0.8em;
      letter-spacing: 0.02em;
      color: var(--color-text-muted);
    }
    #out .step-running-name {
      font-weight: 600;
      font-size: 1em;
      letter-spacing: -0.02em;
      color: var(--color-text-heading);
    }
    .run-footer {
      flex-shrink: 0;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--color-border);
    }
    .footer-row {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .step-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--color-text-muted);
    }
    .progress-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      min-width: 0;
    }
    .progress-wrap.footer-progress {
      flex: 0 1 auto;
      max-width: calc(100% - 5.5rem);
    }
    .footer-step-count {
      flex: 0 0 auto;
      white-space: nowrap;
      text-align: right;
    }
    .progress-segments {
      display: flex;
      gap: 4px;
      align-items: stretch;
      width: max-content;
    }
    .seg {
      flex: 0 0 9px;
      height: 7px;
      border-radius: 4px;
      box-sizing: border-box;
      border: 1px solid color-mix(in srgb, var(--color-text-muted) 45%, var(--color-border));
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .seg-pending {
      background: color-mix(in srgb, var(--color-text-muted) 18%, var(--color-surface-elevated));
    }
    .seg-done { background: var(--color-success); border-color: color-mix(in srgb, var(--color-success) 55%, var(--color-border)); }
    .seg-current {
      background: color-mix(in srgb, var(--color-success) 52%, transparent);
      border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
    }
    .run-footer.run-has-issue .seg-current {
      background: color-mix(in srgb, var(--color-warning) 48%, transparent);
      border-color: color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
    }
    .run-footer.run-has-issue .seg-done {
      background: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 55%, var(--color-border));
    }
`.trim();

export const FORWARD_WIDGET_INLINE_CSS = `${MCP_WIDGET_CHROME_INLINE_CSS}\n${FORWARD_WIDGET_SPECIFIC_INLINE_CSS}`;
