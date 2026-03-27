/** Inline styles for {@link ./forward-widget-html.ts} (MCP Apps HTML bundle). */
export const FORWARD_WIDGET_INLINE_CSS = `
    html {
      font-family: var(--font-sans, system-ui, -apple-system, "Segoe UI", sans-serif);
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    html:not([data-theme]),
    html[data-theme="dark"],
    html.dark {
      color: var(--color-text-primary, #e2e8f0);
      background: var(--color-background-primary, #0f172a);
    }
    html[data-theme="light"] {
      color: var(--color-text-primary, #1e293b);
      background: var(--color-background-primary, #ffffff);
    }
    body { margin: 0; padding: 12px; box-sizing: border-box; display: flex; flex-direction: column; min-height: 0; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-shrink: 0; }
    .brand svg { width: 48px; height: 48px; flex-shrink: 0; border-radius: 10px; }
    h1.header-title {
      font-size: clamp(0.875rem, 2.4vw, 1.0625rem);
      font-weight: 600;
      margin: 0;
      line-height: 1.35;
      letter-spacing: -0.015em;
    }
    h1.header-title .ht-brand {
      font-size: 1em;
      font-weight: 600;
    }
    h1.header-title .ht-sep {
      font-weight: 600;
      opacity: 0.85;
    }
    h1.header-title .ht-protocol-label {
      font-size: 0.8em;
      font-weight: 600;
      letter-spacing: 0.02em;
      vertical-align: baseline;
    }
    html:not([data-theme]) h1.header-title .ht-protocol-label,
    html[data-theme="dark"] h1.header-title .ht-protocol-label,
    html.dark h1.header-title .ht-protocol-label { color: var(--color-text-secondary, #94a3b8); }
    html[data-theme="light"] h1.header-title .ht-protocol-label { color: var(--color-text-secondary, #64748b); }
    h1.header-title .ht-protocol-name {
      font-size: 1em;
      font-weight: 600;
    }
    html:not([data-theme]) #out,
    html[data-theme="dark"] #out,
    html.dark #out {
      background: var(--color-background-secondary, #1e293b);
      border: 1px solid var(--color-border-secondary, #334155);
    }
    html[data-theme="light"] #out {
      background: var(--color-background-secondary, #f8fafc);
      border: 1px solid var(--color-border-secondary, #e2e8f0);
    }
    html:not([data-theme]) #out.step-panel,
    html[data-theme="dark"] #out.step-panel,
    html.dark #out.step-panel {
      box-shadow: inset 3px 0 0 0 rgba(34, 197, 94, 0.42);
    }
    html[data-theme="light"] #out.step-panel {
      box-shadow: inset 3px 0 0 0 rgba(22, 163, 74, 0.38);
    }
    #out {
      margin: 0;
      padding: 10px 12px 10px 14px;
      border-radius: 8px;
      font-size: var(--font-text-sm-size, 0.8125rem);
      line-height: 1.5;
      overflow: auto;
      max-height: min(360px, 70vh);
      flex: 1;
      min-height: 0;
    }
    #out pre.raw {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--font-mono, ui-monospace, monospace);
    }
    /* Step title = 1em; "Running step:" label = 0.8em (same idea as ht-protocol-label) */
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
    }
    html:not([data-theme]) #out .step-running-label,
    html[data-theme="dark"] #out .step-running-label,
    html.dark #out .step-running-label { color: var(--color-text-secondary, #94a3b8); }
    html[data-theme="light"] #out .step-running-label { color: var(--color-text-secondary, #64748b); }
    #out .step-running-name {
      font-weight: 600;
      font-size: 1em;
      letter-spacing: -0.02em;
    }
    .run-footer {
      flex-shrink: 0;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--color-border-secondary, #334155);
    }
    html[data-theme="light"] .run-footer {
      border-top-color: var(--color-border-secondary, #e2e8f0);
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
      font-size: var(--font-text-xs-size, 0.75rem);
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    html:not([data-theme]) .step-label,
    html[data-theme="dark"] .step-label,
    html.dark .step-label { color: var(--color-text-secondary, #94a3b8); }
    html[data-theme="light"] .step-label { color: var(--color-text-secondary, #64748b); }
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
      border: 1px solid var(--color-text-secondary, #94a3b8);
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    html[data-theme="light"] .seg {
      border-color: var(--color-text-secondary, #64748b);
    }
    html:not([data-theme]) .seg-pending,
    html[data-theme="dark"] .seg-pending,
    html.dark .seg-pending { background: rgba(148, 163, 184, 0.2); }
    html[data-theme="light"] .seg-pending { background: rgba(100, 116, 139, 0.15); }
    .seg-done { background: #22c55e; }
    .seg-current { background: rgba(34, 197, 94, 0.5); }
    .run-footer.run-has-issue .seg-current {
      background: rgba(245, 158, 11, 0.45);
    }
    .run-footer.run-has-issue .seg-done { background: #22c55e; }
    .muted { opacity: 0.9; font-style: italic; }
`.trim();
