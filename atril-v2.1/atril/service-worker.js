/* Atril · service worker — guarda la app para usarla sin conexión.
   Las llamadas a la IA van siempre a la red. Sube CACHE al publicar cambios. */
const CACHE = 'atril-v2.1.0';
const ASSETS = ['./', './index.html', './app.js', './estudio.js', './config.js', './manifest.webmanifest',
  './libs/pdf.min.js', './libs/pdf.worker.min.js', './libs/mammoth.browser.min.js', './libs/jszip.min.js', './libs/xlsx.full.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png', './icons/icon-180.png', './icons/icon-32.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Código de la app: primero red (para recibir actualizaciones), si no hay conexión, caché
  const fresh = /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (fresh && !url.pathname.includes('/libs/')) {
    e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(h => h || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return res;
  })));
});
