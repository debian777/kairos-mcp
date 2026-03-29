import { buildActivateWidgetHtml } from '../../src/mcp-apps/activate-widget-html.js';

describe('buildActivateWidgetHtml', () => {
  test('includes MCP Apps handshake and activate tool-result handling', () => {
    const html = buildActivateWidgetHtml();
    expect(html).toContain('ui/initialize');
    expect(html).toContain('ui/notifications/initialized');
    expect(html).toContain('ui/notifications/tool-result');
    expect(html).toContain('isActivateStructured');
    expect(html).toContain('kairos-activate-view');
    expect(html).toContain('ui/notifications/host-context-changed');
    expect(html).toContain('paintHostContext');
    expect(html).toContain('renderActivate');
    expect(html).toContain('ACTIVATE_VISIBLE_CHOICES');
    expect(html).toContain('activate-more-choices');
    expect(html).toContain('More choices (');
    expect(html).toContain('choices-list');
    expect(html).toContain('id="header-title"');
    expect(html).toContain('class="header-title"');
    expect(html).toContain('activate-brand-row');
    expect(html).toContain('headerHtmlWithQuery');
    expect(html).toContain('query: ');
    expect(html).toContain('id="header-top-match"');
    expect(html).toContain('paintTopMatch');
    expect(html).toContain('kairos-activate-root');
    expect(html).toContain('tierFromScore');
    expect(html).toContain('choice-row-top');
    expect(html).toContain('choice-space');
    expect(html).toContain('#kairos-activate-root #out');
    expect(html).toContain('renderHumanError');
    expect(html).toContain('shortHumanErrorMessage');
    expect(html).toContain('Your AI agent was asked to: ');
    expect(html).toContain('Technical details');
    expect(html).not.toContain('<!DOCTYPE html>');
  });
});
