const WORKER_VERSION = '13';
const CACHE_PREFIX = 'joel-football-';
// Written by the build (scripts/precache-manifest.mjs): the app shell and
// hashed bundles (`core`, cached at install), then the referenced art and
// sounds (`media`, `music`), fetched in the background once the worker runs.
// The source copy only caches the shell; development never registers it.
const PRECACHE = /* precache-manifest */ { "build": "source", "core": ["./", "manifest.webmanifest"], "media": [], "music": [] } /* /precache-manifest */;
const CACHE_NAME = `${CACHE_PREFIX}v${WORKER_VERSION}-${PRECACHE.build}`;
// Shared with src/game/services/AudioAssetCache.js so a sound is stored once
// and the game's own audio cache finds what the worker precached.
const AUDIO_CACHE_NAME = 'skyhead-showdown-audio-v1';
const CACHE_ENABLED = new URL(self.location.href).searchParams.get('v') === WORKER_VERSION;
const BACKGROUND_FETCHES = 4;
// Hosts such as `vite preview` answer with `Vary: Origin`; module scripts send
// an Origin header that the install-time requests lacked. Everything cached
// is same-origin, so the stored copy is valid for either request.
const MATCH_OPTIONS = { ignoreVary: true };
const canCache = (request, response) => response.status === 200 && !request.headers.has('range');
const isSound = (url) => /\/assets\/sound\/[^/]+\.mp3$/i.test(new URL(url, self.location.href).pathname);
const cacheFor = (url) => caches.open(isSound(url) ? AUDIO_CACHE_NAME : CACHE_NAME);

const precacheCore = async () => {
  const cache = await caches.open(CACHE_NAME);
  // `reload` skips the HTTP cache so a new build never stores a stale shell.
  await cache.addAll(PRECACHE.core.map((path) => new Request(path, { cache: 'reload' })));
};

let backgroundFill = null;
const fillMissing = (paths) => {
  const queue = [...paths];
  const next = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        if (await caches.match(path, MATCH_OPTIONS)) continue;
        const response = await fetch(path);
        if (response.status === 200) await (await cacheFor(path)).put(path, response);
      } catch {
        // Offline or evicted mid-way; the next page visit asks again.
      }
    }
  };
  return Promise.all(Array.from({ length: BACKGROUND_FETCHES }, next));
};
const precacheMedia = () => {
  if (!CACHE_ENABLED) return Promise.resolve();
  const saveData = self.navigator?.connection?.saveData === true;
  backgroundFill ??= fillMissing([...PRECACHE.media, ...(saveData ? [] : PRECACHE.music)])
    .finally(() => { backgroundFill = null; });
  return backgroundFill;
};

// Media elements ask for byte ranges; answer them from a cached full file.
const rangeResponse = async (request, cached) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (!match) return cached;
  const body = await cached.blob();
  const size = body.size;
  let start = match[1] === '' ? size - Number(match[2]) : Number(match[1]);
  let end = match[1] === '' || match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  start = Math.max(0, start);
  if (start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  end = Math.max(start, end);
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
};

self.addEventListener('install', (event) => {
  if (CACHE_ENABLED) {
    event.waitUntil(precacheCore());
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
      .then(() => self.clients.claim())
      // Not awaited: holding activation would queue the page's requests.
      .then(() => { precacheMedia().catch(() => {}); }),
  );
});

// Pages ask on every start, which resumes a fill the browser interrupted.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'precache-media') event.waitUntil?.(precacheMedia());
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
        .catch(() => caches.match(request, MATCH_OPTIONS).then((cached) => cached ?? caches.match('./', MATCH_OPTIONS))),
    );
    return;
  }

  event.respondWith(
    caches.match(request, MATCH_OPTIONS).then((cached) => {
      if (cached && request.headers.has('range')) return rangeResponse(request, cached);
      const network = fetch(request)
        .then((response) => {
          if (canCache(request, response)) {
            // Clone before yielding to the page: opening the cache is asynchronous,
            // and the browser may consume the original response in the meantime.
            const copy = response.clone();
            cacheFor(request.url).then((cache) => cache.put(request, copy)).catch(() => {});
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
