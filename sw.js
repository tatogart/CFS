// Сервис-воркер: игра сохраняется на устройстве и запускается без интернета.
const VERSION = '1793171803';
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "vendor/three.module.min.js", "css/style.css?v=1793171803", "js/art.js?v=1793171803", "js/bots.js?v=1793171803", "js/controls.js?v=1793171803", "js/data.js?v=1793171803", "js/decor.js?v=1793171803", "js/game.js?v=1793171803", "js/main.js?v=1793171803", "js/maps.js?v=1793171803", "js/models.js?v=1793171803", "js/music.js?v=1793171803", "js/sfx.js?v=1793171803", "js/store.js?v=1793171803", "js/world.js?v=1793171803"];
const CACHE = 'cfs-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('cfs-')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // страница: сначала сеть (чтобы приходили обновления), без сети — из кэша
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  // файлы игры и шрифты: из кэша, иначе из сети с сохранением
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
