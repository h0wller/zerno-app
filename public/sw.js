// public/sw.js
const STATIC_CACHE = 'zerno-static-v352';
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
  '/app/ui/theme-v2.css',
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

  // App Shell: Cache-First с фоновым обновлением
  if (
    request.destination === 'document' ||
    url.pathname.startsWith('/dist/') ||
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