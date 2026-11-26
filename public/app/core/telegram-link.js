/* Shared Telegram deep-link navigation for PWA and Telegram Mini App. */
export function isTelegramMiniApp() {
  const webApp = window.Telegram && window.Telegram.WebApp;
  return !!(
    window.__isTgMiniApp ||
    window.__tgInitData ||
    (webApp && typeof webApp.initData === 'string' && webApp.initData.length > 0)
  );
}

/**
 * Opens the blank tab synchronously in the caller's click stack, then resolves
 * the API-provided URL. A blocked popup is returned to the caller as a visible
 * link target; the page itself is never navigated away from the app.
 */
export function openTelegramLink(resolveUrl) {
  const miniApp = isTelegramMiniApp() ? (window.Telegram && window.Telegram.WebApp) : null;
  const canUseMiniApp = !!(miniApp && typeof miniApp.openTelegramLink === 'function');
  let popup = null;

  if (!canUseMiniApp && typeof window.open === 'function') {
    try {
      popup = window.open('about:blank', '_blank');
    } catch (_) {
      popup = null;
    }
  }

  return Promise.resolve()
    .then(() => (typeof resolveUrl === 'function' ? resolveUrl() : resolveUrl))
    .then((value) => {
      const url = new URL(String(value || ''), window.location.href);
      if (url.protocol !== 'https:' || url.hostname !== 't.me') {
        throw new Error('Сервер вернул некорректную ссылку Telegram');
      }

      if (canUseMiniApp) {
        miniApp.openTelegramLink(url.toString());
        return { opened: true, miniApp: true, url: url.toString() };
      }

      if (popup && !popup.closed) {
        popup.location.replace(url.toString());
        return { opened: true, miniApp: false, url: url.toString() };
      }

      return { opened: false, blocked: true, miniApp: false, url: url.toString() };
    })
    .catch((error) => {
      if (popup && !popup.closed) {
        try { popup.close(); } catch (_) {}
      }
      throw error;
    });
}
