// public/sw.js
const STATIC_CACHE = 'zerno-static-v318';
const MEDIA_CACHE = 'zerno-media-v13';
const API_CACHE = 'zerno-api-v7';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/andCoffee.svg',
  '/friday-logo.svg',
  '/app/main.js',
  '/app/ui/theme-v2.css',
  '/app/ui/brand-tokens.css',
  '/app/brands/registry.js',
  '/app/ui/fonts.css',
  '/app/core/state.js',
  '/app/core/utils.js',
  '/app/core/api.js',
  '/app/core/panel.js',
  '/app/core/catalog.js',
  '/app/core/staffpin.js',
  '/app/core/editor.js',
  '/app/core/promo.js',
  '/app/core/dash.js',
  '/app/core/push-ui.js',
  '/app/core/fx.js',
  '/app/core/overlay-core.js',
  '/app/core/boot.js',
  '/app/core/views.js',
  '/app/core/config.js',
  '/app/core/a11y.js',
  '/app/core/chat-head.js',
  '/app/core/chat-state.js',
  '/app/core/push.js',
  '/app/core/deeplink.js',
  '/app/core/ptr.js',
  '/app/core/address-dict.js',
  '/app/core/address-autocomplete.js',
  '/app/core/preorder-timer.js',
  '/app/core/address-book.js',
  '/app/core/swipe.js',
  '/app/core/notify.js',
  '/app/core/splash.js',
  '/app/core/qr.js',
  '/app/core/review.js',
  '/app/chat.js',
  '/app/chat-core.js',
  '/app/profile.js',
  '/app/profile-brand.js',
  '/app/cashier.js',
  '/app/orders.js',
  '/app/menu.js',
  '/app/menu-editor.js',
  '/app/delivery.js',
  '/app/cart.js',
  '/app/live.js',
  '/app/admin-extra.js',
  '/app/scanner.js',
  '/app/vendor/qrcode.min.js',
  '/app/ui/styles.js',
  '/app/ui/dropdowns.js',
  '/app/ui/settings.js',
  '/app/ui/delivery-search.js',
  '/app/ui/cashier-log.js',
  '/app/ui/cashier-card.js',
  '/app/ui/fonts/golos-text-400-cyrillic.woff2',
  '/app/ui/fonts/golos-text-400-latin.woff2',
  '/app/ui/fonts/golos-text-600-cyrillic.woff2',
  '/app/ui/fonts/golos-text-600-latin.woff2',
  '/app/ui/fonts/golos-text-700-cyrillic.woff2',
  '/app/ui/fonts/golos-text-700-latin.woff2',
  '/app/ui/fonts/prata-400-cyrillic.woff2',
  '/app/ui/fonts/prata-400-latin.woff2',
  '/app/ui/fonts/unbounded-700-cyrillic.woff2',
  '/app/ui/fonts/unbounded-700-latin.woff2'
];

const API_TTL = 5 * 60 * 1000;

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
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, MEDIA_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  if (url.pathname.startsWith('/api/menu')) {
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
    e.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((netRes) => {
          if (netRes.ok) {
            const clone = netRes.clone();
            caches.open(MEDIA_CACHE).then((c) => c.put(request, clone)).catch(() => {});
          }
          return netRes;
        })
        .catch(() => caches.match(request).then((m) => m || new Response('', { status: 503, statusText: 'offline' })))
    );
    return;
  }

  if (/\.(png|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const match = await cache.match(request);
        const network = fetch(request)
          .then((netRes) => {
            if (netRes.ok) cache.put(request, netRes.clone());
            return netRes;
          })
          .catch(() => match || new Response('', { status: 503, statusText: 'offline' }));
        return match || network;
      })
    );
    return;
  }

  // App Shell: Cache-First с фоновым обновлением для мгновенного старта PWA
  if (
    request.destination === 'document' ||
    url.pathname.startsWith('/app/') ||
    /\.(js|css)$/.test(url.pathname)
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request, { cache: 'reload' })
          .then((netRes) => {
            if (netRes.ok) {
              const clone = netRes.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, clone)).catch(() => {});
            }
            return netRes;
          })
          .catch(() => cached || new Response('', { status: 503, statusText: 'offline' }));

        return cached || networkFetch;
      })
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((res) =>
      res || fetch(request).catch(() => new Response('', { status: 503, statusText: 'offline' }))
    )
  );
});
