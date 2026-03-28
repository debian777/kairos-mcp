import { KAIROS_LOGO_SVG } from './kairos-logo-embedded.js';
import { substituteWidgetPresentationToken } from './mcp-widget-presentation-inject.js';

/**
 * MCP Apps HTML fragment for `spaces` (mount root + style + script); host wraps a full document.
 *
 * Hosts (for example Cursor) expect the MCP Apps lifecycle: `ui/initialize`
 * request/response, then `ui/notifications/initialized`, before forwarding
 * `ui/notifications/tool-result`.
 *
 * Theming: apply `hostContext` from `ui/initialize` and
 * `ui/notifications/host-context-changed` (theme + `styles.variables`,
 * optional `styles.css.fonts`). Hosts that only toggle `html.dark` still get a
 * readable surface.
 */
export function buildSpacesWidgetHtml(): string {
  const logo = KAIROS_LOGO_SVG.replaceAll('`', '&#96;');
  return substituteWidgetPresentationToken(`<div id="kairos-spaces-root">
  <div class="brand">
    ${logo}
    <h1>KAIROS · Your spaces</h1>
  </div>
  <div id="out"><span class="waiting">Loading your spaces...</span></div>
  <p class="hint">From the <code>spaces</code> tool: where your adapters live, and how many adapters each space holds. Use the space <strong>name</strong> in other tools when asked for a space, not a raw id.</p>
</div>
<style>
    html { font-family: var(--font-sans, system-ui, sans-serif); }
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
    body { margin: 0; padding: 12px; box-sizing: border-box; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .brand svg { width: 48px; height: 48px; flex-shrink: 0; border-radius: 10px; }
    h1 { font-size: var(--font-heading-sm-size, 1rem); font-weight: 600; margin: 0; }
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
    #out {
      margin: 0;
      padding: 10px;
      border-radius: 8px;
      font-size: var(--font-text-sm-size, 0.8125rem);
      overflow: auto;
      max-height: min(360px, 70vh);
    }
    #out pre.raw {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--font-mono, ui-monospace, monospace);
    }
    table.spaces { width: 100%; border-collapse: collapse; }
    html:not([data-theme]) table.spaces th,
    html:not([data-theme]) table.spaces td,
    html[data-theme="dark"] table.spaces th,
    html[data-theme="dark"] table.spaces td,
    html.dark table.spaces th,
    html.dark table.spaces td {
      border-bottom: 1px solid var(--color-border-secondary, #334155);
    }
    html[data-theme="light"] table.spaces th,
    html[data-theme="light"] table.spaces td {
      border-bottom: 1px solid var(--color-border-secondary, #e2e8f0);
    }
    table.spaces th, table.spaces td { text-align: left; padding: 6px 8px; }
    html:not([data-theme]) table.spaces th,
    html[data-theme="dark"] table.spaces th,
    html.dark table.spaces th { color: var(--color-text-secondary, #94a3b8); font-weight: 600; }
    html[data-theme="light"] table.spaces th { color: var(--color-text-secondary, #64748b); font-weight: 600; }
    html:not([data-theme]) .hint,
    html[data-theme="dark"] .hint,
    html.dark .hint { color: var(--color-text-secondary, #94a3b8); }
    html[data-theme="light"] .hint { color: var(--color-text-secondary, #64748b); }
    .hint { font-size: var(--font-text-xs-size, 0.75rem); margin-top: 8px; }
    .lead {
      margin: 0 0 10px 0;
      line-height: 1.45;
      font-size: var(--font-text-sm-size, 0.8125rem);
    }
    html:not([data-theme]) .lead,
    html[data-theme="dark"] .lead,
    html.dark .lead { color: var(--color-text-secondary, #94a3b8); }
    html[data-theme="light"] .lead { color: var(--color-text-secondary, #64748b); }
</style>
<script>
    (function () {
      var el = document.getElementById('out');
      var PROTO = '2026-01-26';
      var nextId = 1;
      var pending = {};
      var hostCtxState = {};
      var PRESENTATION_ONLY = __KAIROS_WIDGET_PRESENTATION_ONLY__;

      function mergeHostContextDelta(prev, delta) {
        var base = {};
        var pk;
        for (pk in prev) {
          if (Object.prototype.hasOwnProperty.call(prev, pk)) base[pk] = prev[pk];
        }
        if (!delta || typeof delta !== 'object') return base;
        var k;
        for (k in delta) {
          if (!Object.prototype.hasOwnProperty.call(delta, k)) continue;
          var v = delta[k];
          if (k === 'styles' && v && typeof v === 'object') {
            base.styles = base.styles || {};
            if (v.variables && typeof v.variables === 'object') {
              base.styles.variables = base.styles.variables || {};
              var vk;
              for (vk in v.variables) {
                if (Object.prototype.hasOwnProperty.call(v.variables, vk)) {
                  base.styles.variables[vk] = v.variables[vk];
                }
              }
            }
            if (v.css && typeof v.css === 'object') {
              base.styles.css = base.styles.css || {};
              var ck;
              for (ck in v.css) {
                if (Object.prototype.hasOwnProperty.call(v.css, ck)) base.styles.css[ck] = v.css[ck];
              }
            }
          } else if (v !== undefined) {
            base[k] = v;
          }
        }
        return base;
      }

      function paintHostContext(ctx) {
        if (!ctx || typeof ctx !== 'object') return;
        if (ctx.theme === 'light' || ctx.theme === 'dark') {
          document.documentElement.setAttribute('data-theme', ctx.theme);
          document.documentElement.style.colorScheme = ctx.theme;
          if (ctx.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        var st = ctx.styles;
        if (st && st.variables && typeof st.variables === 'object') {
          var root = document.documentElement;
          var name;
          for (name in st.variables) {
            if (!Object.prototype.hasOwnProperty.call(st.variables, name)) continue;
            var val = st.variables[name];
            if (val != null && val !== '') root.style.setProperty(name, String(val));
          }
        }
        if (st && st.css && st.css.fonts && typeof st.css.fonts === 'string' && st.css.fonts.trim()) {
          var fid = 'kairos-host-fonts';
          var styleEl = document.getElementById(fid);
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = fid;
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = st.css.fonts;
        }
      }

      function post(msg) {
        try { window.parent.postMessage(msg, '*'); } catch (e) {}
      }

      function sendRequest(method, params, timeoutMs) {
        timeoutMs = timeoutMs || 10000;
        return new Promise(function (resolve, reject) {
          var id = nextId++;
          var t = setTimeout(function () {
            delete pending[id];
            reject(new Error('Request timeout: ' + method));
          }, timeoutMs);
          pending[id] = {
            resolve: function (r) { clearTimeout(t); resolve(r); },
            reject: function (err) { clearTimeout(t); reject(err); }
          };
          post({ jsonrpc: '2.0', id: id, method: method, params: params });
        });
      }

      function sendNotification(method, params) {
        post({ jsonrpc: '2.0', method: method, params: params || {} });
      }

      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function showJson(obj) {
        var pre = document.createElement('pre');
        pre.className = 'raw';
        try { pre.textContent = JSON.stringify(obj, null, 2); } catch (e) { pre.textContent = String(obj); }
        el.replaceChildren(pre);
      }

      function renderSpacesTable(sc) {
        var spaces = (sc && sc.spaces) ? sc.spaces : [];
        var rows = spaces.map(function (s) {
          var name = escapeHtml(s.name != null ? s.name : '');
          var n = s.adapter_count != null ? String(s.adapter_count) : '0';
          return '<tr><td>' + name + '</td><td>' + escapeHtml(n) + '</td></tr>';
        }).join('');
        var lead = '<p class="lead" role="note">Each row is one space and the number of adapters stored there.</p>';
        el.innerHTML = lead + '<table class="spaces" role="grid" aria-label="Spaces and adapter counts"><thead><tr><th>Space name</th><th>Adapter count</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="2">No spaces are available for this session.</td></tr>') + '</tbody></table>';
      }

      function applyToolResult(p) {
        if (PRESENTATION_ONLY) return;
        if (!p) return;
        if (p.isError) {
          showJson({ isError: true, content: p.content, message: p.message });
          return;
        }
        if (p.structuredContent != null && p.structuredContent.spaces) {
          renderSpacesTable(p.structuredContent);
          return;
        }
        if (p.structuredContent != null) {
          showJson(p.structuredContent);
          return;
        }
        if (p.content && p.content[0] && p.content[0].text) {
          try { renderSpacesTable(JSON.parse(p.content[0].text)); } catch (e) { showJson(p.content[0].text); }
          return;
        }
        showJson(p);
      }

      window.addEventListener('message', function (ev) {
        var d = ev.data;
        if (!d || d.jsonrpc !== '2.0') return;
        if (d.id != null && Object.prototype.hasOwnProperty.call(pending, d.id)) {
          var h = pending[d.id];
          delete pending[d.id];
          if (d.error) h.reject(d.error);
          else h.resolve(d.result);
          return;
        }
        var m = d.method;
        if (m === 'ui/notifications/host-context-changed' && d.params) {
          hostCtxState = mergeHostContextDelta(hostCtxState, d.params);
          paintHostContext(hostCtxState);
          return;
        }
        if (m === 'ui/notifications/tool-result' && d.params) {
          applyToolResult(d.params);
          return;
        }
        if (m === 'notifications/tool-result' && d.params) {
          applyToolResult(d.params);
        }
      });

      function boot() {
        if (PRESENTATION_ONLY) {
          if (el) {
            el.replaceChildren();
            var ph = document.createElement('span');
            ph.className = 'waiting';
            ph.textContent =
              'Presentation-only: MCP bridge disabled (set KAIROS_MCP_WIDGET_PRESENTATION_ONLY=false for live data).';
            el.appendChild(ph);
          }
          return;
        }
        sendRequest('ui/initialize', {
          appInfo: { name: 'kairos-spaces-view', version: '1.0.0' },
          appCapabilities: {},
          protocolVersion: PROTO
        }).then(function (result) {
          if (result && result.hostContext) {
            hostCtxState = mergeHostContextDelta({}, result.hostContext);
            paintHostContext(hostCtxState);
          }
          sendNotification('ui/notifications/initialized', {});
        }).catch(function (err) {
          var msg = (err && err.message) ? err.message : String(err);
          el.replaceChildren();
          el.textContent = 'This panel could not finish starting (' + msg + '). The same data may still appear as normal text in the chat.';
        });
      }

      boot();
    })();
</script>`);
}
