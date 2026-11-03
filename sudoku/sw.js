/* 纸感数独 · 离线缓存 */
const CACHE = 'paper-sudoku-v21';
const CORE = [
  './',
  './index.html',
  './2048.html',
  './styles.css',
  './2048.css',
  './manifest.json',
  './js/config.js',
  './js/sudoku.js',
  './js/remote.js',
  './js/app.js',
  './js/2048.js',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(CORE.map((file) => new Request(file, { cache: 'reload' })))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** 判断一个 Response 是否值得缓存（2xx + basic，不是 404 兜底） */
function shouldCache(response) {
  return (
    response &&
    response.ok &&
    response.type === 'basic' &&
    Number(response.status) >= 200 &&
    Number(response.status) < 400
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只缓存真正的 200 响应；GitHub Pages 下若访问不存在的路径会返回 404 HTML
          // 但 status 是 404，shouldCache 会过滤掉
          if (shouldCache(response)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match('./index.html'))
            .then((fallback) => fallback || new Response('', { status: 503 }))
        )
    );
    return;
  }

  // 资源走「先用缓存、后台更新」
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (shouldCache(response)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const response = await network;
      return response || new Response('', { status: 504, statusText: 'Offline' });
    })()
  );
});