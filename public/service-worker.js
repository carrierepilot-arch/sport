const CACHE_NAME = 'sport-v3';
const MEDIA_CACHE = 'sport-media-v1';
const urlsToCache = [
  '/',
  '/login',
  '/register',
  '/dashboard',
  '/dashboard/entrainement',
  '/dashboard/analyse',
  '/dashboard/profil',
  '/offline',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/exercise-media/frames/push-ups-1.png',
  '/exercise-media/frames/push-ups-2.png',
  '/exercise-media/frames/pull-ups-1.png',
  '/exercise-media/frames/pull-ups-2.png',
  '/exercise-media/frames/chin-ups-1.png',
  '/exercise-media/frames/chin-ups-2.png',
  '/exercise-media/frames/body-row-1.png',
  '/exercise-media/frames/body-row-2.png',
  '/exercise-media/frames/chest-dips-1.png',
  '/exercise-media/frames/chest-dips-2.png',
  '/exercise-media/frames/tricep-dips-1.png',
  '/exercise-media/frames/tricep-dips-2.png',
  '/exercise-media/frames/close-triceps-pushup-1.png',
  '/exercise-media/frames/close-triceps-pushup-2.png',
  '/exercise-media/frames/crunches-1.png',
  '/exercise-media/frames/crunches-2.png',
  '/exercise-media/frames/flutter-kicks-1.png',
  '/exercise-media/frames/flutter-kicks-2.png',
  '/exercise-media/frames/side-plank-1.png',
  '/exercise-media/frames/side-plank-2.png',
  '/exercise-media/frames/walking-lunges-1.png',
  '/exercise-media/frames/walking-lunges-2.png',
  '/exercise-media/frames/squats-using-dumbbells-1.png',
  '/exercise-media/frames/squats-using-dumbbells-2.png',
];

async function cacheMediaUrls(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  await Promise.all(urls.map(async (url) => {
    if (!url) return;
    try {
      const response = await fetch(url, { mode: 'no-cors' });
      await cache.put(url, response);
    } catch {
      // ignore prefetch failures
    }
  }));
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_MEDIA_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheMediaUrls(event.data.urls));
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            if (cacheName === MEDIA_CACHE) return undefined;
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request)
            .then((response) => {
              if (response && (response.ok || response.type === 'opaque')) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => caches.match(request));
        })
      )
    );
    return;
  }

  // Skip other external resources
  if (!url.origin.includes(self.location.origin)) {
    return;
  }

  // Cache API GET responses opportunistically, but never block on them.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })))
    );
    return;
  }

  // For navigation requests, use network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline');
          });
        })
    );
    return;
  }

  // For other requests, use cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        const cache = caches.open(CACHE_NAME);
        cache.then((c) => c.put(request, response.clone()));
        return response;
      });
    })
  );
});
