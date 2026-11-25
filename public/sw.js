// public/sw.js
const STATIC_CACHE = 'zerno-static-v671';
const MEDIA_CACHE = 'zerno-media-v20';
const API_CACHE = 'zerno-api-v14';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/andCoffee.svg',
  '/friday-logo.svg',
  '/dist/main.bundle.js',
  '/app/brands/registry.js',
  '/app/ui/theme/00-head.css',
  '/app/ui/theme/10-base.css',
  '/app/ui/theme/20-cards.css',
  '/app/ui/theme/30-utils.css',
  '/app/ui/theme/40-catalog.css',
  '/app/ui/theme/50-edit-mode.css',
  '/app/ui/theme/60-cart.css',
  '/app/ui/theme/70-ticker.css',
  '/app/ui/theme/80-splash.css',
  '/app/ui/theme/90-modals.css',
  '/app/ui/theme/100-chat.css',
  '/app/ui/theme/110-panel.css',
  '/app/ui/theme/120-cashier.css',
  '/app/ui/theme/130-service.css',
  '/app/ui/theme/140-topbar.css',
  '/app/ui/theme/150-rail.css',
  '/app/ui/theme/160-01-rail-fab-mobile.css',
  '/app/ui/theme/160-02-addr-panel-fix.css',
  '/app/ui/theme/160-03-topbar-search-panel.css',
  '/app/ui/theme/160-04-wrap-cls-sheets.css',
  '/app/ui/theme/160-05-base-components.css',
  '/app/ui/theme/160-06-delivery-header.css',
  '/app/ui/theme/160-07-orders-cards.css',
  '/app/ui/theme/160-08-cart-addons.css',
  '/app/ui/theme/160-09-preorder-subfilters.css',
  '/app/ui/theme/160-10-rail-mobile-opts.css',
  '/app/ui/theme/160-11-canonical-grid-menu.css',
  '/app/ui/theme/160-12-admin-bar-tail.css',
  '/app/ui/theme/160-13-dashboard-bento.css',
  '/app/ui/theme/160-14-auth-modal.css',
  '/app/ui/theme/160-15-mobile-support-toolbar.css',
  '/app/ui/theme/170-profile-button.css',
  '/app/ui/brand-tokens.css',
  '/app/ui/fonts.css',
  '/app/core/address-autocomplete.js',
  '/app/core/address-book.js',
  '/app/core/preorder-timer.js',
  '/app/vendor/qrcode.min.js',
  '/jsqr.js',
  '/app/ui/fonts/prata-400-cyrillic.woff2',
  '/app/ui/fonts/golos-text-400.woff2',
  '/app/ui/fonts/unbounded-700-cyrillic.woff2'
];

const API_TTL = 5 * 60 * 1000;
const MAX_MEDIA_CACHE_ENTRIES = 300;
let mediaCacheWriteQueue = Promise.resolve();

async function trimMediaCache(cache) {
  const requests = await cache.keys();
  const excess = requests.length - MAX_MEDIA_CACHE_ENTRIES;
  if (excess > 0) {
    await Promise.all(requests.slice(0, excess).map((entry) => cache.delete(entry)));
  }
}

function cacheMediaResponse(request, response) {
  const write = mediaCacheWriteQueue.then(async () => {
    const cache = await caches.open(MEDIA_CACHE);
    await cache.put(request, response);
    await trimMediaCache(cache);
  });
  mediaCacheWriteQueue = write.catch(() => {});
  return write;
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Ошибка предзагрузки:', url, err))
        )
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all([
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, MEDIA_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    ),
    caches.open(MEDIA_CACHE).then(trimMediaCache).catch(() => {})
  ]));
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function safeNotificationUrl(value) {
  try {
    const target = new URL(value || '/', self.location.origin);
    return target.origin === self.location.origin
      ? target.href
      : self.location.origin + '/';
  } catch (_) {
    return self.location.origin + '/';
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      if (event.data) {
        try { payload = event.data.json() || {}; }
        catch (_) {
          const raw = event.data.text();
          try { payload = JSON.parse(raw); }
          catch (_) { payload = { body: raw }; }
        }
      }
    } catch (_) {}

    const title = String(payload.title || '…и кофе').slice(0, 120);
    const body = String(payload.body || payload.text || 'Есть обновление').slice(0, 500);
    const url = safeNotificationUrl(payload.url || payload.data?.url || '/');

    await self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag ? String(payload.tag).slice(0, 120) : undefined,
      data: { url }
    });

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach(client => {
      try { client.postMessage({ type: 'zpush' }); } catch (_) {}
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = safeNotificationUrl(event.notification.data?.url || '/');
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        if (typeof client.navigate === 'function' && client.url !== target) {
          await client.navigate(target);
        }
        await client.focus();
        return;
      } catch (_) {}
    }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== location.origin ||
    url.pathname.startsWith('/api/orders') ||
    url.pathname.startsWith('/api/chat') ||
    url.pathname.startsWith('/api/auth')
  ) {
    return;
  }

  if (url.pathname.startsWith('/api/menu') || url.pathname.startsWith('/api/dmenu')) {
    e.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cachedRes = await cache.match(request);
        const fetchPromise = fetch(request)
          .then(async (netRes) => {
            if (netRes.ok) {
              const headers = new Headers(netRes.headers);
              headers.append('sw-timestamp', Date.now().toString());
              const body = await netRes.clone().blob();
              await cache.put(
                request,
                new Response(body, {
                  status: netRes.status,
                  statusText: netRes.statusText,
                  headers
                })
              );
            }
            return netRes;
          })
          .catch(() => cachedRes);

        if (cachedRes) {
          const ts = cachedRes.headers.get('sw-timestamp');
          if (ts && Date.now() - parseInt(ts, 10) < API_TTL) {
            return cachedRes;
          }
        }
        return fetchPromise;
      })
    );
    return;
  }

  if (/\.svg$/.test(url.pathname)) {
    let mediaWrite = Promise.resolve();
    const network = fetch(request, { cache: 'no-cache' })
      .then((netRes) => {
        if (netRes.ok) mediaWrite = cacheMediaResponse(request, netRes.clone()).catch(() => {});
        return netRes;
      })
      .catch(() => caches.match(request).then((m) => m || new Response('', { status: 503, statusText: 'offline' })));
    e.waitUntil(network.then(() => mediaWrite));
    e.respondWith(network);
    return;
  }

  if (/\.(png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    let network = Promise.resolve();
    let mediaWrite = Promise.resolve();
    const response = caches.open(MEDIA_CACHE).then(async (cache) => {
      const match = await cache.match(request);
      network = fetch(request)
        .then((netRes) => {
          if (netRes.ok) mediaWrite = cacheMediaResponse(request, netRes.clone()).catch(() => {});
          return netRes;
        })
        .catch(() => match || new Response('', { status: 503, statusText: 'offline' }));
      return match || network;
    });
    e.waitUntil(response.then(() => network).then(() => mediaWrite));
    e.respondWith(response);
    return;
  }

  // App Shell: Network-First (гарантия единой свежей версии в браузере, PWA и TG Mini App)
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.startsWith('/dist/') ||
    url.pathname.startsWith('/app/') ||
    /\.(js|css)$/.test(url.pathname)
  ) {
    e.respondWith(
      fetch(request, { cache: 'reload' })
        .then((netRes) => {
          if (netRes.ok) {
            const clone = netRes.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone)).catch(() => {});
          }
          return netRes;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true }).then((cached) => cached || new Response('', { status: 503, statusText: 'offline' }))
        )
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((res) =>
      res || fetch(request).catch(() => new Response('', { status: 503, statusText: 'offline' }))
    )
  );
});