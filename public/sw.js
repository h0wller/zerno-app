// public/sw.js
const STATIC_CACHE = 'zerno-static-v83'; // ← поставь своё текущее значение +1
const MEDIA_CACHE = 'zerno-media-v11';
const API_CACHE = 'zerno-api-v7';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  './andCoffee.svg',
  './friday-logo.svg',
  '/app/ui/theme-v2.css',
  '/app/core/state.js',
  '/app/core/utils.js',
  '/app/core/api.js',
  '/app/core/views.js',
  '/app/core/config.js',
  '/app/core/a11y.js',
  '/app/core/chat-head.js',
  '/app/core/chat-state.js',
  '/app/core/push.js',
  '/app/core/deeplink.js',
  '/app/core/overlay.js',
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
  '/app/ui/cashier-card.js'
];
const API_TTL = 5 * 60 * 1000; // 5 минут

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Загружаем файлы независимо: если один споткнется, остальные сохранятся и SW не упадет
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Ошибка предзагрузки ресурса:', url, err))
        )
      );
    })
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
                cache.put(request, new Response(body, {
                  status: clone.status,
                  statusText: clone.statusText,
                  headers
                }));
              });
            }
            return netRes;
          })
          .catch(() => cachedRes);
        if (cachedRes) {
          const ts = cachedRes.headers.get('sw-timestamp');
          if (ts && Date.now() - parseInt(ts, 10) < API_TTL) return cachedRes;
        }
        return fetchPromise;
      })
    );
    return;
  }

  // 2. Медиа: Stale-While-Revalidate. Кэш отвечает мгновенно, обновление скачивается фоном —
  // новый логотип/картинки приходят на СЛЕДУЮЩЕЙ загрузке после деплоя, без хард-ресета.
  // 2a. SVG (логотипы/иконки): network-first с ревалидацией — F5 ВСЕГДА показывает свежий файл,
  // офлайн — отдаём кэш. Лечит «логотип не меняется при F5».
  if (/\.svg$/.test(url.pathname)) {
    e.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((netRes) => {
          if (netRes.ok) {
            const c = netRes.clone();
            caches.open(MEDIA_CACHE).then((cc) => cc.put(request, c)).catch(() => { });
          }
          return netRes;
        })
        .catch(() => caches.match(request).then((m) => m || new Response('', { status: 503, statusText: 'offline' })))
    );
    return;
  }
  // 2b. Остальные медиа (фото позиций): Stale-While-Revalidate — кэш мгновенно, свежее фоном.
  if (url.pathname.match(/.(png|jpg|jpeg|webp|ico)$/)) {
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

  // 3. App Shell: network-first для кода. Ф3.30: нет сети и нет кэша — явный 503, а не reject
  if (request.destination === 'document' || url.pathname.startsWith('/app/') || /\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(request)
        .then((netRes) => {
          if (netRes.ok) {
            const clone = netRes.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone)).catch(() => { });
          }
          return netRes;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || new Response('/* offline */', {
              status: 503,
              statusText: 'offline',
              headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
            })
          )
        )
    );
    return;
  }

  // 4. Остальная статика — cache-first. Ф3.30: здесь тоже не reject'уем
  e.respondWith(
    caches.match(request).then((res) =>
      res || fetch(request).catch(() => new Response('', { status: 503, statusText: 'offline' }))
    )
  );
});