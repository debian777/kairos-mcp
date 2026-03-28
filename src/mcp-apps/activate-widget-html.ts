import { ACTIVATE_WIDGET_INLINE_CSS } from './activate-widget-inline-css.js';
import { ACTIVATE_WIDGET_INLINE_SCRIPT } from './activate-widget-inline-script.js';
import { substituteWidgetPresentationToken } from './mcp-widget-presentation-inject.js';

/**
 * MCP Apps HTML resource as a fragment (mount root + style + script), matching Confluence-style
 * widgets: the host supplies the document shell.
 */
export function buildActivateWidgetHtml(): string {
  return `<div id="kairos-activate-root">
  <h1 id="header-title">KAIROS · Activate</h1>
  <div id="out"><span class="waiting">Loading activation results…</span></div>
</div>
<style>
${ACTIVATE_WIDGET_INLINE_CSS}
</style>
<script>
${substituteWidgetPresentationToken(ACTIVATE_WIDGET_INLINE_SCRIPT)}
</script>`;
}
