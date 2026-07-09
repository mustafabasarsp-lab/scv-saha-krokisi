const CACHE_NAME = 'scv-saha-v1-cache-4';
const CORE_ASSETS = [
  './scv-saha-v1.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(() => { /* offline ilk kurulum: sessizce yut */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('googleapis.com') || url.includes('firebaseapp.com') || url.includes('firebaseio.com')) {
    return; // Firestore/Auth trafiğine dokunma - kendi ağ katmanını kullansın
  }

  // HTML sayfası (uygulamanın kendisi): önce internetten en güncelini çek,
  // sadece çevrimdışıyken önbelleğe düş. Böylece güncellemeler her zaman
  // ilk açılışta gelir, eski sürüm takılı kalmaz.
  const isHtmlNavigation = event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/');
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Diğer statik dosyalar (kütüphaneler, ikonlar): önbellekten hemen göster,
  // arka planda güncelle (stale-while-revalidate) - bunlar sık değişmiyor.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
