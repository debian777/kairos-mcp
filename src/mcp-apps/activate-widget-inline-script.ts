/** Inline boot script for {@link ./activate-widget-html.ts} (MCP Apps HTML bundle). */
export const ACTIVATE_WIDGET_INLINE_SCRIPT = `
    (function () {
      var el = document.getElementById('out');
      var headerTitle = document.getElementById('header-title');
      var headerTopMatch = document.getElementById('header-top-match');
      var PROTO = '2026-01-26';
      var nextId = 1;
      var pending = {};
      var hostCtxState = {};
      var MAX_CHOICES = 40;
      /** Omit last N choices in the panel only (tool JSON unchanged); typical refine/create footer. */
      var WIDGET_DROP_LAST_CHOICES = 2;
      var BATCH = 10;
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
          if (ctx.theme === 'dark') document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
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

      function notifySize() {
        requestAnimationFrame(function () {
          var h = document.documentElement.scrollHeight;
          sendNotification('ui/notifications/size-changed', { height: h });
        });
      }

      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function headerHtmlIdle() {
        return '<span class="ht-brand">KAIROS</span><span class="ht-sep"> • </span><span class="ht-protocol-label">Activate • </span><span class="ht-protocol-name muted">…</span>';
      }

      function headerHtmlWithQuery(q) {
        var safe = escapeHtml(q && String(q).trim() ? String(q).trim() : '—');
        return (
          '<span class="ht-brand">KAIROS</span><span class="ht-sep"> • </span><span class="ht-protocol-label">Activate • </span><span class="ht-protocol-label">query: </span><span class="ht-protocol-name">' +
          safe +
          '</span>'
        );
      }

      function clearTopMatch() {
        if (!headerTopMatch) return;
        headerTopMatch.hidden = true;
        headerTopMatch.removeAttribute('data-tier');
        headerTopMatch.removeAttribute('aria-label');
        headerTopMatch.innerHTML = '';
      }

      function paintTopMatch(list) {
        if (!headerTopMatch) return;
        var bestScore = -1;
        var i;
        for (i = 0; i < list.length; i++) {
          var ch = list[i];
          if (!ch || normRole(ch.role) !== 'match') continue;
          var s = ch.activation_score;
          if (s == null || typeof s !== 'number' || isNaN(s)) continue;
          if (s > bestScore) bestScore = s;
        }
        if (bestScore < 0) {
          clearTopMatch();
          return;
        }
        var pct = Math.round(bestScore * 1000) / 10;
        var tier = bestScore >= 0.8 ? '4' : bestScore >= 0.65 ? '3' : bestScore >= 0.5 ? '2' : '1';
        headerTopMatch.hidden = false;
        headerTopMatch.setAttribute('data-tier', tier);
        headerTopMatch.setAttribute('aria-label', 'Top match ' + pct + ' percent');
        headerTopMatch.innerHTML =
          '<div class="header-top-match-inner">' +
          '<span class="top-match-label">Top match</span>' +
          '<span class="top-match-pct">' +
          pct +
          '%</span></div>';
      }

      function showJson(obj) {
        clearTopMatch();
        if (headerTitle) headerTitle.innerHTML = headerHtmlIdle();
        document.title = 'Activate — KAIROS';
        if (el) {
          var pre = document.createElement('pre');
          pre.className = 'raw';
          try { pre.textContent = JSON.stringify(obj, null, 2); } catch (e) { pre.textContent = String(obj); }
          el.replaceChildren(pre);
        }
        notifySize();
      }

      function isActivateStructured(sc) {
        return sc && typeof sc === 'object' && typeof sc.must_obey === 'boolean' &&
          Array.isArray(sc.choices) && typeof sc.next_action === 'string' && typeof sc.message === 'string';
      }

      function normRole(r) {
        var s = r && String(r);
        if (s === 'match' || s === 'refine' || s === 'create') return s;
        return 'match';
      }

      function scoreText(role, score) {
        if (role !== 'match' || score == null || typeof score !== 'number') return '';
        return String(Math.round(score * 1000) / 10) + '% match';
      }

      function buildChoiceEl(ch, index) {
        var li = document.createElement('li');
        li.className = 'choice';
        var role = normRole(ch && ch.role);
        var label = ch && ch.label != null ? String(ch.label) : 'Choice ' + (index + 1);
        var adapterName = ch && ch.adapter_name != null && String(ch.adapter_name).trim()
          ? String(ch.adapter_name).trim() : '';
        var space = ch && ch.space_name != null && String(ch.space_name).trim()
          ? String(ch.space_name).trim() : '';
        var row = document.createElement('div');
        row.className = 'choice-row';
        var pill = document.createElement('span');
        pill.className = 'pill';
        pill.setAttribute('data-role', role);
        pill.textContent = role;
        row.appendChild(pill);
        var title = document.createElement('span');
        title.className = 'choice-title';
        title.textContent = label;
        row.appendChild(title);
        var st = scoreText(role, ch && ch.activation_score);
        if (st) {
          var scEl = document.createElement('span');
          scEl.className = 'choice-score';
          scEl.textContent = st;
          row.appendChild(scEl);
        }
        li.appendChild(row);
        var meta = [];
        if (adapterName && adapterName !== label) meta.push(adapterName);
        if (space) meta.push('Space: ' + space);
        if (meta.length) {
          var mp = document.createElement('p');
          mp.className = 'sub';
          mp.textContent = meta.join(' · ');
          li.appendChild(mp);
        }
        return li;
      }

      function renderActivate(sc) {
        var total = sc.choices.length;
        var raw = total > MAX_CHOICES ? sc.choices.slice(0, MAX_CHOICES) : sc.choices;
        var capped = total > MAX_CHOICES;
        var list =
          raw.length > WIDGET_DROP_LAST_CHOICES
            ? raw.slice(0, raw.length - WIDGET_DROP_LAST_CHOICES)
            : raw;
        if (headerTitle) {
          headerTitle.innerHTML = headerHtmlWithQuery(sc.query != null ? sc.query : '');
        }
        paintTopMatch(list);
        var qt = sc.query != null && String(sc.query).trim() ? String(sc.query).trim() : 'Activate';
        document.title = qt.length > 48 ? qt.slice(0, 45) + '… — KAIROS' : qt + ' — KAIROS';
        if (!el) return;
        el.replaceChildren();

        var ul = document.createElement('ul');
        ul.className = 'choices-list';
        ul.setAttribute('role', 'list');
        el.appendChild(ul);

        var i = 0;
        function pump() {
          var end = Math.min(i + BATCH, list.length);
          for (; i < end; i++) {
            ul.appendChild(buildChoiceEl(list[i], i));
          }
          if (i < list.length) {
            requestAnimationFrame(pump);
          } else {
            if (capped) {
              var note = document.createElement('p');
              note.className = 'cap-note';
              note.textContent = 'Showing ' + MAX_CHOICES + ' of ' + total + ' choices.';
              el.appendChild(note);
            }
            notifySize();
          }
        }
        requestAnimationFrame(pump);
      }

      function applyToolResult(p) {
        if (PRESENTATION_ONLY) return;
        if (!p) return;
        if (p.isError) {
          showJson({ isError: true, content: p.content, message: p.message });
          return;
        }
        if (p.structuredContent != null && isActivateStructured(p.structuredContent)) {
          renderActivate(p.structuredContent);
          return;
        }
        if (p.structuredContent != null) {
          showJson(p.structuredContent);
          return;
        }
        if (p.content && p.content[0] && p.content[0].text) {
          try {
            var parsed = JSON.parse(p.content[0].text);
            if (isActivateStructured(parsed)) renderActivate(parsed);
            else showJson(parsed);
          } catch (e) { showJson(p.content[0].text); }
          return;
        }
        showJson(p);
      }

      function boot() {
        if (PRESENTATION_ONLY) {
          clearTopMatch();
          if (headerTitle) headerTitle.innerHTML = headerHtmlIdle();
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
          appInfo: { name: 'kairos-activate-view', version: '1.0.0' },
          appCapabilities: {},
          protocolVersion: PROTO
        }).then(function (result) {
          if (result && result.hostContext) {
            hostCtxState = mergeHostContextDelta({}, result.hostContext);
            paintHostContext(hostCtxState);
          }
          sendNotification('ui/notifications/initialized', {});
        }).catch(function (err) {
          clearTopMatch();
          if (headerTitle) headerTitle.innerHTML = headerHtmlIdle();
          if (el) {
            var msg = (err && err.message) ? err.message : String(err);
            el.replaceChildren();
            el.textContent = 'This panel could not finish starting (' + msg + '). The same data may still appear as normal text in the chat.';
          }
        });
      }

      boot();
    })();
`.trim();
