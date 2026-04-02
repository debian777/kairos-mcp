/**
 * Shared layout + tokens for MCP Apps HTML widgets (forward, activate).
 * Forward-specific rules stay in {@link ./forward-widget-inline-css.ts}.
 */
export const MCP_WIDGET_CHROME_INLINE_CSS = `
    /* Color + type tokens — keep in sync with src/ui/theme/tokens-theme-light.css (+ dark block if extended) */
    :root {
      --color-primary: #0d9488;
      --color-primary-hover: #0f766e;
      --color-primary-focus: #0d9488;
      --color-secondary: #64748b;
      --color-accent: #0ea5e9;
      --color-text: #1e293b;
      --color-text-heading: #0f172a;
      --color-text-muted: #64748b;
      --color-surface: #ffffff;
      --color-surface-elevated: #f8fafc;
      --color-border: #e2e8f0;
      --color-error: #dc2626;
      --color-error-bg: #fef2f2;
      --color-success: #16a34a;
      --color-warning: #d97706;
      --color-focus-ring: var(--color-primary);
      --font-sans: system-ui, sans-serif;
      --font-size-xs: 0.75rem;
      --font-size-sm: 0.875rem;
      --font-size-base: 1rem;
      --radius-md: 0.375rem;
      --radius-lg: 0.5rem;
    }
    html[data-theme="dark"],
    html.dark {
      --color-text: #e2e8f0;
      --color-text-heading: #f8fafc;
      --color-text-muted: #94a3b8;
      --color-surface: #0f172a;
      --color-surface-elevated: #1e293b;
      --color-border: #334155;
    }
    html {
      font-family: var(--font-sans, system-ui, -apple-system, "Segoe UI", sans-serif);
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      color: var(--color-text);
      background: var(--color-surface);
    }
    body { margin: 0; padding: 8px; box-sizing: border-box; display: flex; flex-direction: column; min-height: 0; }
    .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-shrink: 0; }
    .brand svg { width: 36px; height: 36px; flex-shrink: 0; border-radius: 8px; }
    h1.header-title {
      font-size: clamp(0.875rem, 2.4vw, 1.0625rem);
      font-weight: 600;
      margin: 0;
      line-height: 1.35;
      letter-spacing: -0.015em;
      color: var(--color-text-heading);
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
      color: var(--color-text-muted);
    }
    h1.header-title .ht-protocol-name {
      font-size: 1em;
      font-weight: 600;
    }
    #out {
      margin: 0;
      padding: 8px 10px;
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      line-height: 1.5;
      overflow: visible;
      max-height: none;
      flex: 0 1 auto;
      min-height: 0;
      background: var(--color-surface-elevated);
      border: 1px solid var(--color-border);
    }
    #out pre.raw {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, monospace;
    }
    .muted { opacity: 0.9; font-style: italic; color: var(--color-text-muted); }
`.trim();
