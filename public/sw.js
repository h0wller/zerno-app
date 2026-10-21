// public/sw.js
const STATIC_CACHE = 'zerno-static-v531';
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
  '/app/ui/theme/170-profile-button.css',
  '/app/ui/brand-tokens.css',
  '/app/ui/fonts.css',
  '/app/core/address-dict.js',
  '/app/core/address-autocomplete.js',
  '/app/core/address-book.js',
  '/app/core/preorder-timer.js',
  '/app/vendor/qrcode.min.js',
  '/app/ui/fonts/golos-text-400-cyrillic.woff2',
  '/app/ui/fonts/golos-text-600-cyrillic.woff2',
  '/app/ui/fonts/golos-text-700-cyrillic.woff2',
  '/app/ui/fonts/prata-400-cyrillic.woff2',
  '/app/ui/fonts/unbounded-700-cyrillic.woff2'
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