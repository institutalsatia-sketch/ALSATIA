// ============================================
// Service Worker ALSATIA — VERSION SAFE DEV
// - Pas de cache JS dynamique (app / dm / drive)
// - Cache HTML / CSS / images uniquement
// - Mise à jour immédiate
// ============================================

const CACHE_NAME = 'alsatia-v3';

const STATIC_ASSETS = [
  './login.html',
  './index.html',
  './style.css',
  './logo_alsatia.png',
  './herrade.png',
  './martin.png',
  './academia.png'
];

// -----------------------------
// INSTALL
// -----------------------------
self.addEventListener('install', (event) => {
  self.skipWaiting(); // ⬅️ actif immédiatement

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ SW: cache static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// -----------------------------
// ACTIVATE
// -----------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('🗑️ SW: suppression ancien cache', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // ⬅️ contrôle immédiat
    })
  );
});

// -----------------------------
// FETCH STRATEGY
// -----------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1️⃣ Ignorer tout ce qui n'est pas GET
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // 2️⃣ NE JAMAIS CACHER LES JS DYNAMIQUES
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.includes('supabase') ||
    url.pathname.includes('/rest/')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // 3️⃣ HTML / CSS / images → Network First
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
