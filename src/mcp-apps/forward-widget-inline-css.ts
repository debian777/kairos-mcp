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
    /* Current step: amber/yellow (in progress), distinct from green completed segments. */
    .seg-current {
      background: color-mix(in srgb, var(--color-warning) 72%, var(--color-surface-elevated));
      border-color: color-mix(in srgb, var(--color-warning) 58%, var(--color-border));
    }
    html.dark .seg-current {
      background: color-mix(in srgb, var(--color-warning) 55%, transparent);
      border-color: color-mix(in srgb, var(--color-warning) 48%, var(--color-border));
    }
    /* Retry / error_context on this layer: warmer, error-tinted current segment. */
    .seg-current.seg-issue {
      background: color-mix(in srgb, var(--color-error) 42%, var(--color-warning) 58%);
      border-color: color-mix(in srgb, var(--color-error) 55%, var(--color-border));
    }
    html.dark .seg-current.seg-issue {
      background: color-mix(in srgb, var(--color-error) 48%, var(--color-warning) 52%);
      border-color: color-mix(in srgb, var(--color-error) 55%, var(--color-border));
    }
    .run-footer.run-has-issue .seg-done {
      background: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 55%, var(--color-border));
    }
    .widget-error {
      margin: 0;
      padding: 0;
    }
    .widget-error-title {
      margin: 0 0 8px 0;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--color-text-heading);
    }
    .widget-error-msg {
      margin: 0 0 10px 0;
      font-size: var(--font-size-sm);
      line-height: 1.5;
      color: var(--color-text);
    }
    .widget-error-next {
      margin: 0 0 14px 0;
      font-size: var(--font-size-sm);
      line-height: 1.45;
      color: var(--color-text-muted);
    }
    .widget-error-next-label {
      font-weight: 600;
      color: var(--color-text-heading);
    }
    .widget-error-details {
      margin: 0;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 6px 10px;
    }
    .widget-error-details summary {
      cursor: pointer;
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-text-muted);
      user-select: none;
    }
    .widget-error-raw {
      margin: 8px 0 0 0;
      max-height: 240px;
      overflow: auto;
    }
`.trim();

export const FORWARD_WIDGET_INLINE_CSS = `${MCP_WIDGET_CHROME_INLINE_CSS}\n${FORWARD_WIDGET_SPECIFIC_INLINE_CSS}`;
