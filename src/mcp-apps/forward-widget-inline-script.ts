/** Inline boot script for {@link ./forward-widget-html.ts} (MCP Apps HTML bundle). */
export const FORWARD_WIDGET_INLINE_SCRIPT = `
    (function () {
      var el = document.getElementById('out');
      var headerTitle = document.getElementById('header-title');
      var runFooter = document.getElementById('run-footer');
      var stepText = document.getElementById('step-text');
      var segHost = document.getElementById('progress-segments');
      var PROTO = '2026-01-26';
      var nextId = 1;
      var pending = {};
      var hostCtxState = {};
      var PRESENTATION_ONLY = __KAIROS_WIDGET_PRESENTATION_ONLY__;

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
          return;
        }
      });

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

      function headerHtmlIdle() {
        return '<span class="ht-brand">KAIROS</span><span class="ht-sep"> • </span><span class="ht-protocol-label">Protocol:</span>';
      }

      function headerHtmlWithProtocol(name) {
        var safe = escapeHtml(name || 'Forward run');
        return headerHtmlIdle() + ' <span class="ht-protocol-name">' + safe + '</span>';
      }

      function resetChrome() {
        if (headerTitle) headerTitle.innerHTML = headerHtmlIdle();
        if (runFooter) runFooter.hidden = true;
        document.title = 'Forward — KAIROS';
      }

      function showJson(obj) {
        resetChrome();
        if (el) el.classList.remove('step-panel');
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

      function formatStepTitle(sc) {
        var label = sc.current_layer_label != null && String(sc.current_layer_label).trim()
          ? String(sc.current_layer_label).trim() : '';
        if (!label) {
          return '<p class="step-running"><span class="step-running-label">Running step:</span> <span class="muted">No title in this response</span></p>';
        }
        return '<p class="step-running"><span class="step-running-label">Running step:</span> <span class="step-running-name">' +
          escapeHtml(label) + '</span></p>';
      }

      function renderProgress(idx, cnt, hasIssue) {
        if (!segHost || !stepText || !runFooter) return;
        var i;
        var n = typeof cnt === 'number' && cnt > 0 ? Math.floor(cnt) : 0;
        var cur = typeof idx === 'number' && idx > 0 ? Math.floor(idx) : 1;
        if (n < 1) {
          runFooter.hidden = true;
          return;
        }
        if (cur < 1) cur = 1;
        if (cur > n) cur = n;
        runFooter.hidden = false;
        runFooter.classList.toggle('run-has-issue', !!hasIssue);
        stepText.textContent = 'Step ' + cur + ' of ' + n;

        segHost.replaceChildren();
        for (i = 1; i <= n; i++) {
          var seg = document.createElement('span');
          seg.className = 'seg';
          if (i < cur) seg.classList.add('seg-done');
          else if (i === cur) seg.classList.add('seg-current');
          else seg.classList.add('seg-pending');
          segHost.appendChild(seg);
        }
      }

      function renderForward(sc) {
        var adapterRaw = sc.context_adapter_name != null && String(sc.context_adapter_name).trim()
          ? String(sc.context_adapter_name).trim() : '';
        if (headerTitle) {
          headerTitle.innerHTML = headerHtmlWithProtocol(adapterRaw || 'Forward run');
        }
        document.title = (adapterRaw || 'Forward') + ' — KAIROS';

        if (el) el.classList.add('step-panel');
        el.innerHTML = formatStepTitle(sc);

        var idx = sc.adapter_layer_index;
        var cnt = sc.adapter_layer_count;
        var hasIssue = !!(sc.error_code || (typeof sc.retry_count === 'number' && sc.retry_count > 0));
        renderProgress(idx, cnt, hasIssue);
      }

      function applyToolResult(p) {
        if (PRESENTATION_ONLY) return;
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

      function boot() {
        if (PRESENTATION_ONLY) {
          resetChrome();
          if (el) el.classList.remove('step-panel');
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
          resetChrome();
          if (el) el.classList.remove('step-panel');
          var msg = (err && err.message) ? err.message : String(err);
          el.replaceChildren();
          el.textContent = 'This panel could not finish starting (' + msg + '). The same data may still appear as normal text in the chat.';
        });
      }

      boot();
    })();
`.trim();
