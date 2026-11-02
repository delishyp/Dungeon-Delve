/* Service worker: caches the whole game so it works offline after the first visit.
 * CACHE is replaced at build time with a content hash, so a new build updates the app. */
const CACHE = 'dungeon-delve-@@HASH@@';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/favicon-32.png', '@@ASSET_FILES@@'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first for the page (so updates arrive when online), cache first for everything else.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
