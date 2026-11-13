/**
 * Custody Calendar — Service Worker
 */

const CACHE_NAME = 'custody-calendar-v50';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css?v=47',
  './js/db.js?v=37',
  './js/holidays.js?v=27',
  './js/schedule.js?v=22',
  './js/calendar.js?v=49',
  './js/ui.js?v=50',
  './js/app.js?v=41',
  './lib/meta-png.js?v=1',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('custody-calendar-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
