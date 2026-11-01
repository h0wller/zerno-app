/* public/app/core/api.js — F1.2: базовая обёртка над fetch (UMD-ish) */
(function () {
  const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
// App server :3000 and isolated Playwright server :3100 serve their own API.
// Static local frontends on other ports (Live Server/Vite) use the API on :3000.
  const isAppOrigin = !isLocal || location.port === '3000' || location.port === '3100';
  const API_BASE = isAppOrigin ? location.origin : 'http://localhost:3000';   

  Object.assign(window, { API_BASE });
})();