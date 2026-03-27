import { describe, expect, it } from '@jest/globals';
import { renderSpacesWidgetHtml } from '../../src/mcp-apps/spaces-widget-html.js';

describe('renderSpacesWidgetHtml', () => {
  it('escapes angle brackets in titles and names', () => {
    const html = renderSpacesWidgetHtml([
      {
        name: '<script>',
        space_id: 'user:r:x',
        type: 'personal',
        adapter_count: 1,
        adapters: [{ adapter_id: 'a1', title: '<b>evil</b>', layer_count: 2 }]
      }
    ]);
    expect(html).not.toMatch(/<script>/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;evil&lt;/b&gt;');
  });

  it('renders type badge and adapter details', () => {
    const html = renderSpacesWidgetHtml([
      {
        name: 'Group: Team',
        space_id: 'group:r:team',
        type: 'group',
        adapter_count: 1,
        adapters: [{ adapter_id: 'uuid-here', title: 'Demo', layer_count: 3 }]
      }
    ]);
    expect(html).toMatch(/Group/);
    expect(html).toMatch(/Personal|Group|App|Other/);
    expect(html).toContain('Demo');
    expect(html).toContain('details');
  });
});
