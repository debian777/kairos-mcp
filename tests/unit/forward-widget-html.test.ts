import { buildForwardWidgetHtml } from '../../src/mcp-apps/forward-widget-html.js';

describe('buildForwardWidgetHtml', () => {
  test('includes MCP Apps handshake and forward tool-result handling', () => {
    const html = buildForwardWidgetHtml();
    expect(html).toContain('ui/initialize');
    expect(html).toContain('ui/notifications/initialized');
    expect(html).toContain('ui/notifications/tool-result');
    expect(html).toContain('isForwardStructured');
    expect(html).toContain('kairos-forward-view');
    expect(html).toContain('ui/notifications/host-context-changed');
    expect(html).toContain('paintHostContext');
    expect(html).toContain('data-theme');
    expect(html).toContain('html.dark');
    expect(html).toContain("classList.add('dark')");
    expect(html).toContain('id="header-title"');
    expect(html).toContain('id="progress-segments"');
    expect(html).toContain('id="step-text"');
    expect(html).not.toContain('status-pill');
    expect(html).toContain('formatStepTitle');
    expect(html).toContain('renderProgress');
    expect(html).toContain('kairos-forward-root');
    expect(html).toContain('renderHumanError');
    expect(html).toContain('seg-issue');
    expect(html).toContain('widget-error-title');
    expect(html).toContain('Technical details');
    expect(html).toContain('notifySize');
    expect(html).not.toContain('<!DOCTYPE html>');
  });
});
