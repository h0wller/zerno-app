/* public/app/core/ui.js */
(function () {
  'use strict';

  /* ── 1. Сетевые запросы: api() ── */
  async function api(path, opts = {}) {
    const base = (typeof API_BASE !== 'undefined' ? API_BASE : '').replace(/\/+$/, '');
    
    // Нормализация пути: добавляем /api, если его нет и это не абсолютный URL
    let url = path;
    if (!path.startsWith('http')) {
      const cleanPath = path.startsWith('/') ? path : '/' + path;
      const apiPath = cleanPath.startsWith('/api/') || cleanPath === '/api' ? cleanPath : '/api' + cleanPath;
      url = base + apiPath;
    }

    const token = (typeof USER_TOKEN !== 'undefined' && USER_TOKEN) || localStorage.getItem('zt_user');

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {})
    };

    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
    });

    if (res.status === 401) {
      window.__ztAuthDead = true;
      if (typeof setUser === 'function') {
        setUser(null, null);
      } else {
        localStorage.removeItem('zt_user');
        window.USER_TOKEN = null;
        window.me = null;
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error || 'Ошибка ' + res.status);
      err.status = res.status;
      err.code = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }
  /* ── 2. Системные уведомления: toast() ── */
  function toast(msg, icon, action) {
    if (!msg) return;

    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.className = 'toasts';
      document.body.appendChild(host);
    }

    const t = document.createElement('div');
    t.className = 'toast';
    const ic = icon !== undefined ? icon : 'ℹ️';
    const safeMsg = typeof esc === 'function' ? esc(msg) : String(msg);

    t.innerHTML = (ic ? '<span style="font-size:18px">' + ic + '</span> ' : '') + '<span>' + safeMsg + '</span>';

    if (typeof action === 'function') {
      t.style.cursor = 'pointer';
      t.addEventListener('click', function () {
        try { action(); } catch (_) {}
        t.remove();
      });
    }

    host.appendChild(t);

    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () {
        t.remove();
      }, 300);
    }, 4000);

    return t;
  }

  /* ── 3. Индикатор даты обновления меню: renderUpd() ── */
  function renderUpd() {
    const u = document.getElementById('updWhen');
    const ud = document.getElementById('updWhenD');
    if (!u && !ud) return;

    const ts = (typeof meta !== 'undefined' && meta && meta.updatedAt) ? meta.updatedAt : Date.now();
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    const formatted = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' в ' + pad(d.getHours()) + ':' + pad(d.getMinutes());

    const text = 'Меню актуально на <b>' + formatted + '</b>';
    if (u) u.innerHTML = text;
    if (ud) ud.innerHTML = text;
  }

  /* ── Экспорт в глобальную область видимости (контракт F1.3) ── */
  window.api = api;
  window.toast = toast;
  window.renderUpd = renderUpd;
})();