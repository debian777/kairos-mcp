/**
 * Activate MCP App styles: shared chrome ({@link ./mcp-widget-chrome-inline-css.ts}) + choice list.
 */
import { MCP_WIDGET_CHROME_INLINE_CSS } from './mcp-widget-chrome-inline-css.js';

const ACTIVATE_WIDGET_SPECIFIC_INLINE_CSS = `
    .brand.activate-brand-row {
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .activate-brand-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .activate-brand-left .header-title {
      min-width: 0;
    }
    .header-top-match {
      flex-shrink: 0;
      max-width: 38%;
      text-align: right;
      line-height: 1.25;
    }
    .header-top-match-inner {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .top-match-label {
      font-size: 0.72em;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--color-text-muted);
    }
    /* Same scale/weight as h1.header-title / .ht-brand; color = strength (green → amber). */
    .top-match-pct {
      font-size: clamp(0.875rem, 2.4vw, 1.0625rem);
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--color-text-muted);
    }
    .header-top-match[data-tier="4"] .top-match-pct,
    .pill[data-tier="4"] .pill-pct { color: #15803d; }
    html.dark .header-top-match[data-tier="4"] .top-match-pct,
    html.dark .pill[data-tier="4"] .pill-pct { color: #4ade80; }
    .header-top-match[data-tier="3"] .top-match-pct,
    .pill[data-tier="3"] .pill-pct { color: #16a34a; }
    html.dark .header-top-match[data-tier="3"] .top-match-pct,
    html.dark .pill[data-tier="3"] .pill-pct { color: #86efac; }
    .header-top-match[data-tier="2"] .top-match-pct,
    .pill[data-tier="2"] .pill-pct { color: #65a30d; }
    html.dark .header-top-match[data-tier="2"] .top-match-pct,
    html.dark .pill[data-tier="2"] .pill-pct { color: #bef264; }
    .header-top-match[data-tier="1"] .top-match-pct,
    .pill[data-tier="1"] .pill-pct { color: #ca8a04; }
    html.dark .header-top-match[data-tier="1"] .top-match-pct,
    html.dark .pill[data-tier="1"] .pill-pct { color: #fcd34d; }
    .waiting { opacity: 0.9; font-style: italic; color: var(--color-text-muted); }
    .choices-list { list-style: none; margin: 0; padding: 0; }
    .choice {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 8px 10px;
      margin-bottom: 8px;
      background: var(--color-surface);
    }
    /* Activate list: no inner scroll — host iframe resizes via ui/notifications/size-changed. */
    #kairos-activate-root #out {
      max-height: none;
      overflow: visible;
      flex: 0 1 auto;
    }
    .choice-row { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; margin-bottom: 4px; }
    .choice-row.choice-row-top {
      flex-wrap: nowrap;
      align-items: center;
      width: 100%;
      gap: 8px;
      margin-bottom: 6px;
    }
    .pill {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .pill .pill-pct {
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .pill[data-role="match"][data-tier] .pill-role {
      color: var(--color-text-muted);
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
    .choice-space {
      margin-left: auto;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-muted);
      text-align: right;
      max-width: 55%;
      min-width: 0;
      word-break: break-word;
      flex-shrink: 1;
      line-height: 1.3;
    }
    .choice-title-row {
      width: 100%;
    }
    .choice-title {
      display: block;
      width: 100%;
      font-weight: 600;
      line-height: 1.35;
      color: var(--color-text-heading);
    }
    .sub { font-size: 12px; color: var(--color-text-muted); margin: 2px 0; word-break: break-word; }
    .cap-note { font-size: 12px; font-style: italic; color: var(--color-text-muted); margin-top: 8px; }
`.trim();

export const ACTIVATE_WIDGET_INLINE_CSS = `${MCP_WIDGET_CHROME_INLINE_CSS}\n${ACTIVATE_WIDGET_SPECIFIC_INLINE_CSS}`;
