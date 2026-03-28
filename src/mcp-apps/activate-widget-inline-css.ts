/**
 * Minimal self-contained styles for {@link ./activate-widget-html.ts}.
 * Intentionally small (no shared chrome import): less for the webview to parse.
 */
export const ACTIVATE_WIDGET_INLINE_CSS = `
    :root { color-scheme: light dark; }
    html, body { margin: 0; padding: 0; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.45; color: #1e293b; background: #fff; }
    html[data-theme="dark"], html.dark { color: #e2e8f0; background: #0f172a; }
    body { padding: 10px 12px; box-sizing: border-box; display: flex; flex-direction: column; min-height: 0; }
    h1 { font-size: 1rem; font-weight: 600; margin: 0 0 10px 0; color: inherit; }
    #out { flex: 1; min-height: 0; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; }
    html[data-theme="dark"] #out, html.dark #out { border-color: #334155; background: #1e293b; }
    .waiting { opacity: 0.75; font-style: italic; }
    .msg { margin: 0 0 10px 0; }
    .nextbox { margin: 0 0 12px 0; padding: 8px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; }
    .nextbox .lbl { display: block; font-weight: 600; color: #64748b; margin-bottom: 4px; }
    html[data-theme="dark"] .nextbox .lbl, html.dark .nextbox .lbl { color: #94a3b8; }
    .choices-list { list-style: none; margin: 0; padding: 0; }
    .choice { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; background: #fff; }
    html[data-theme="dark"] .choice, html.dark .choice { border-color: #334155; background: #0f172a; }
    .choice-row { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; margin-bottom: 4px; }
    .pill { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 999px; border: 1px solid #cbd5e1; }
    .pill[data-role="match"] { background: #ecfdf5; border-color: #6ee7b7; color: #047857; }
    .pill[data-role="refine"] { background: #e0f2fe; border-color: #7dd3fc; color: #0369a1; }
    .pill[data-role="create"] { background: #fffbeb; border-color: #fcd34d; color: #b45309; }
    html[data-theme="dark"] .pill[data-role="match"], html.dark .pill[data-role="match"] { background: #064e3b; color: #6ee7b7; border-color: #059669; }
    html[data-theme="dark"] .pill[data-role="refine"], html.dark .pill[data-role="refine"] { background: #0c4a6e; color: #7dd3fc; border-color: #0284c7; }
    html[data-theme="dark"] .pill[data-role="create"], html.dark .pill[data-role="create"] { background: #78350f; color: #fcd34d; border-color: #d97706; }
    .choice-title { font-weight: 600; flex: 1; min-width: 0; }
    .choice-score { font-size: 11px; color: #64748b; }
    .sub { font-size: 12px; color: #64748b; margin: 2px 0; word-break: break-word; }
    html[data-theme="dark"] .sub, html.dark .sub, html[data-theme="dark"] .choice-score, html.dark .choice-score { color: #94a3b8; }
    .uri { font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; color: #64748b; margin: 4px 0 0 0; }
    .cap-note { font-size: 12px; font-style: italic; color: #64748b; margin-top: 8px; }
    pre.raw { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 12px; }
`.trim();
