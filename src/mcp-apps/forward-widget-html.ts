import { KAIROS_LOGO_SVG } from './kairos-logo-embedded.js';

/**
 * HTML5 MCP App for the `forward` tool: Kairos mark + adapter / space + current layer.
 * Same MCP Apps lifecycle as {@link ./spaces-mcp-app-widget-html.ts}.
 */
export function buildForwardWidgetHtml(): string {
  const logo = KAIROS_LOGO_SVG.replaceAll('`', '&#96;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Your forward step — KAIROS</title>
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
    dl.forward { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: baseline; }
    dl.forward dt {
      font-weight: 600;
      margin: 0;
    }
    html:not([data-theme]) dl.forward dt,
    html[data-theme="dark"] dl.forward dt,
    html.dark dl.forward dt { color: var(--color-text-secondary, #94a3b8); }
    html[data-theme="light"] dl.forward dt { color: var(--color-text-secondary, #64748b); }
    dl.forward dd { margin: 0; }
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
    .muted { opacity: 0.9; font-style: italic; }
  </style>
</head>
<body>
  <div class="brand">
    ${logo}
    <h1>KAIROS · Your run</h1>
  </div>
  <div id="out"><span class="waiting">Loading this forward step…</span></div>
  <p class="hint">From the <code>forward</code> tool: which adapter is running, which space it belongs to, and the current step. Follow <code>next_action</code> and the layer <code>contract</code> in chat—this card is only a quick summary.</p>
  <script>
    (function () {
      var el = document.getElementById('out');
      var PROTO = '2026-01-26';
      var nextId = 1;
      var pending = {};
      var hostCtxState = {};

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

      function isForwardStructured(sc) {
        return sc && typeof sc === 'object' && typeof sc.must_obey === 'boolean' &&
          sc.contract && typeof sc.contract === 'object' && typeof sc.contract.type === 'string' &&
          typeof sc.next_action === 'string';
      }

      function renderForward(sc) {
        var adapter = sc.context_adapter_name != null && String(sc.context_adapter_name).trim()
          ? escapeHtml(String(sc.context_adapter_name).trim()) : '';
        var space = sc.activation_space_name != null && String(sc.activation_space_name).trim()
          ? escapeHtml(String(sc.activation_space_name).trim()) : '';
        var layer = sc.current_layer_label != null && String(sc.current_layer_label).trim()
          ? escapeHtml(String(sc.current_layer_label).trim()) : '';
        var line1 = '';
        if (adapter && space) {
          line1 = adapter + ' <span style="opacity:0.85">(' + space + ')</span>';
        } else if (adapter) {
          line1 = adapter;
        } else if (space) {
          line1 = space;
        } else {
          line1 = '<span class="muted">Not included in this response</span>';
        }
        var line2 = layer || '<span class="muted">Not included in this response</span>';
        var lead = '<p class="lead" role="note">Call <strong>activate</strong> first to pick an adapter, then <strong>forward</strong> advances one step at a time until you reach <strong>reward</strong>.</p>';
        el.innerHTML = lead + '<dl class="forward" aria-label="Forward run summary">' +
          '<dt>Adapter in use</dt><dd>' + line1 + '</dd>' +
          '<dt>Current step</dt><dd>' + line2 + '</dd>' +
          '</dl>';
      }

      function applyToolResult(p) {
        if (!p) return;
        if (p.isError) {
          showJson({ isError: true, content: p.content, message: p.message });
          return;
        }
        if (p.structuredContent != null && isForwardStructured(p.structuredContent)) {
          renderForward(p.structuredContent);
          return;
        }
        if (p.structuredContent != null) {
          showJson(p.structuredContent);
          return;
        }
        if (p.content && p.content[0] && p.content[0].text) {
          try {
            var parsed = JSON.parse(p.content[0].text);
            if (isForwardStructured(parsed)) renderForward(parsed);
            else showJson(parsed);
          } catch (e) { showJson(p.content[0].text); }
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
        sendRequest('ui/initialize', {
          appInfo: { name: 'kairos-forward-view', version: '1.0.0' },
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
  </script>
</body>
</html>`;
}
