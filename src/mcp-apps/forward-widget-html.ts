import { KAIROS_LOGO_SVG } from './kairos-logo-embedded.js';
import { FORWARD_WIDGET_INLINE_CSS } from './forward-widget-inline-css.js';
import { FORWARD_WIDGET_INLINE_SCRIPT } from './forward-widget-inline-script.js';

/**
 * HTML5 MCP App for the `forward` tool: KAIROS • Protocol: … header, Running step: … body, progress footer.
 * Same MCP Apps lifecycle as {@link ./spaces-mcp-app-widget-html.ts}.
 */
export function buildForwardWidgetHtml(): string {
  const logo = KAIROS_LOGO_SVG.replaceAll('`', '&#96;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Forward — KAIROS</title>
  <style>
${FORWARD_WIDGET_INLINE_CSS}
  </style>
</head>
<body>
  <div class="brand">
    ${logo}
    <h1 id="header-title" class="header-title"><span class="ht-brand">KAIROS</span><span class="ht-sep"> • </span><span class="ht-protocol-label">Protocol:</span></h1>
  </div>
  <div id="out"><span class="waiting">Loading this forward step…</span></div>
  <footer id="run-footer" class="run-footer" hidden>
    <div class="footer-row">
      <div class="progress-wrap footer-progress">
        <div id="progress-segments" class="progress-segments" aria-hidden="true"></div>
      </div>
      <span id="step-text" class="step-label footer-step-count" role="status"></span>
    </div>
  </footer>
  <script>
${FORWARD_WIDGET_INLINE_SCRIPT}
  </script>
</body>
</html>`;
}
