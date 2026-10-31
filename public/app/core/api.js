/* public/app/core/api.js — F1.2: базовая обёртка над fetch (UMD-ish) */
(function () {
  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
// App server :3000 and isolated Playwright server :3100 serve their own API.
// Static local frontends on other ports (Live Server/Vite) use the API on :3000.
  const isAppOrigin = !isLocal || location.port === '3000' || location.port === '3100';
  const API_BASE = isAppOrigin ? location.origin : 'http://localhost:3000';   

  function authHeaders() {
    const t = window.USER_TOKEN;
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  /**
   * fetchJSON(path, opts)
   *   path  — '/api/menu' (без BASE, BASE подставится сам)
   *   opts  — { method?, body?, headers?, base?, raw? }
   *           raw:true — вернуть Response как есть, без парсинга
   * Возвращает распарсенный JSON. На !res.ok бросает Error со свойствами .status и .data.
   */
  async function fetchJSON(path, opts = {}) {
    const base = opts.base ?? API_BASE;
    const url = path.startsWith('http') ? path : base + path;
    const headers = {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
      ...authHeaders(),
    };
    const res = await fetch(url, { ...opts, headers });
    if (opts.raw) return res;
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  Object.assign(window, { API_BASE, fetchJSON });
})();