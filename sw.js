const CACHE_NAME = 'scv-saha-v1-cache-112';
const CORE_ASSETS = [
  './scv-saha-v1.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Arayüz yazı tipi (Archivo, değişken ağırlık). HTML her sürümde baştan indirilirken
  // (network-first) font ayrı dosya olduğu için stale-while-revalidate yoluna girer ve
  // önbellekten anında gelir. Türkçe için iki alt küme de gerekli: ğ/ş/İ ve ₺ latin-ext'te.
  './archivo-latin.woff2',
  './archivo-latin-ext.woff2',
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
  if (url.includes('api.open-meteo.com')) {
    return; // hava durumu: her zaman ağdan (network-only), asla önbelleğe alma - bayat hava gösterilmesin
  }

  // HTML sayfası (uygulamanın kendisi): önce internetten en güncelini çek,
  // sadece çevrimdışıyken önbelleğe düş. Böylece güncellemeler her zaman
  // ilk açılışta gelir, eski sürüm takılı kalmaz.
  const isHtmlNavigation = event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/');
  if (isHtmlNavigation) {
    const agdan = fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    });
    // Ağ isteği reddedilirse ve yarış çoktan önbellekle sonuçlanmışsa, bu
    // reddin sahipsiz kalmaması için ayrı bir tüketici bağlanır.
    agdan.catch(() => {});

    // "Ağ yok" ile "ağ çok yavaş" tarayıcı için aynı şey değil: şebeke zayıfken
    // fetch reddedilmez, dakikalarca askıda kalır ve uygulama o süre boyunca boş
    // ekranda beklerdi (sahada en sık şikayet edilen davranış). Süre dolduğunda
    // önbellekteki sürüm gösterilir. Ağ isteği İPTAL EDİLMEZ: arka planda
    // tamamlanıp önbelleği tazeler, böylece bir sonraki açılış güncel gelir ve
    // otomatik güncelleme düzeni bozulmaz.
    const AG_ZAMAN_ASIMI_MS = 4000;
    const zamanAsiminda = new Promise(cozumle => {
      setTimeout(() => cozumle(caches.match(event.request).then(onbellekli => onbellekli || agdan)), AG_ZAMAN_ASIMI_MS);
    });

    event.respondWith(
      Promise.race([agdan, zamanAsiminda])
        // Çevrimdışı (fetch anında reddedilir): doğrudan önbelleğe düş.
        .catch(() => caches.match(event.request))
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
