// CacheStorage is shared by every project on a github.io origin. Keep both
// reads and version cleanup inside this registration's own scope.
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `cubica-offline:${encodeURIComponent(SCOPE.pathname)}:`;
const CACHE = `${CACHE_PREFIX}v3`;
const ASSETS = [
  './', './index.html', './style.css', './app.js', './favicon.svg',
  './modules/cube.js', './modules/renderer.js', './modules/graphs.js',
  './modules/curriculum.js', './modules/practice.js', './modules/insights.js', './modules/solver.js',
  './modules/solver-worker.js', './vendor/cubejs/cube.js', './vendor/cubejs/solve.js',
];
const ASSET_URLS = ASSETS.map(path => new URL(path, SCOPE).href);
const ALLOWED = new Set(ASSET_URLS);
const INDEX_URL = new URL('./index.html', SCOPE).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSET_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== SCOPE.origin) return;
  // A cache-busting query still identifies the same deployed static file.
  url.search = '';
  url.hash = '';
  if (!ALLOWED.has(url.href)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type !== 'opaque') {
      const copy = response.clone();
      // Cache quota or storage restrictions must not break a working network.
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.href, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => {
    try {
      const cache = await caches.open(CACHE);
      return (await cache.match(url.href))
        || (event.request.mode === 'navigate' && await cache.match(INDEX_URL))
        || Response.error();
    } catch {
      return Response.error();
    }
  }));
});
