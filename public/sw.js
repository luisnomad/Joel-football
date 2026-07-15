const WORKER_VERSION = '3';
const CACHE_PREFIX = 'joel-football-';
const CACHE_NAME = `${CACHE_PREFIX}v${WORKER_VERSION}`;
const SHELL_FILES = ['./', './manifest.webmanifest'];
const CACHE_ENABLED = new URL(self.location.href).searchParams.get('v') === WORKER_VERSION;
const canCache = (request, response) => response.status === 200 && !request.headers.has('range');

self.addEventListener('install', (event) => {
  if (CACHE_ENABLED) {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
  }
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  if (!CACHE_ENABLED) {
    event.waitUntil(
      caches.keys()
        .then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name))))
        .then(() => self.registration.unregister()),
    );
    return;
  }

  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (!CACHE_ENABLED) return;
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (canCache(request, response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (canCache(request, response)) {
            // Clone before yielding to the page: opening the cache is asynchronous,
            // and the browser may consume the original response in the meantime.
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch((error) => {
          if (cached) return cached;
          throw error;
        });
      return cached ?? network;
    }),
  );
});
