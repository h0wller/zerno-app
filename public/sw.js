// public/sw.js
const STATIC_CACHE = 'zerno-static-v4';
const MEDIA_CACHE = 'zerno-media-v4';
const API_CACHE = 'zerno-api-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app/ui/theme-v2.css',
  '/app/core/views.js',
  '/app/menu.js',
  '/app/cart.js',
  '/app/profile.js',
  '/manifest.webmanifest'
];

const API_TTL = 5 * 60 * 1000; // 5 минут

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
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

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

 // Игнорируем мутации, внешние домены (fonts.googleapis.com и т.д.) и служебные ручки
  if (
    request.method !== 'GET' ||
    url.origin !== location.origin ||
    url.pathname.startsWith('/api/orders') ||
    url.pathname.startsWith('/api/chat') ||
    url.pathname.startsWith('/api/auth')
  ) {
    return;
  }

  // 1. SWR для меню
  if (url.pathname.startsWith('/api/menu')) {
    e.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cachedRes = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((netRes) => {
            if (netRes.ok) {
              const clone = netRes.clone();
              const headers = new Headers(clone.headers);
              headers.append('sw-timestamp', Date.now().toString());

              clone.blob().then((body) => {
                cache.put(
                  request,
                  new Response(body, {
                    status: clone.status,
                    statusText: clone.statusText,
                    headers
                  })
                );
              });
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

  // 2. Cache-First для медиа-ресурсов
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico)$/)) {
    e.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const match = await cache.match(request);
        if (match) return match;

        try {
          const netRes = await fetch(request);
          if (netRes.ok) {
            cache.put(request, netRes.clone());
          }
          return netRes;
        } catch (err) {
          return match;
        }
      })
    );
    return;
  }

  // 3. App Shell
  e.respondWith(
    caches.match(request).then((res) => res || fetch(request))
  );
});