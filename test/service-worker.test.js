import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { injectPrecacheManifest, isReferenced, templateAssetPatterns } from '../scripts/precache-manifest.mjs';
import { AUDIO_CACHE_NAME } from '../src/game/services/AudioAssetCache.js';

describe('service worker caching', () => {
  it('clones a network response before an asynchronous cache open can let the page consume it', async () => {
    const listeners = new Map();
    let openCache;
    let receiveCachedResponse;
    const cacheOpened = new Promise((resolve) => { openCache = resolve; });
    const cachedResponseReceived = new Promise((resolve) => { receiveCachedResponse = resolve; });
    const caches = {
      match: vi.fn(async () => undefined),
      open: vi.fn(() => cacheOpened),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
    };
    const self = {
      location: { origin: 'https://game.test', href: 'https://game.test/sw.js?v=13' },
      addEventListener: (name, listener) => listeners.set(name, listener),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn(async () => {}) },
    };
    const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    vm.runInNewContext(source, {
      self,
      caches,
      fetch: vi.fn(async () => new Response('game asset')),
      URL,
    });

    let responsePromise;
    listeners.get('fetch')({
      request: new Request('https://game.test/assets/player.webp'),
      respondWith: (promise) => { responsePromise = promise; },
    });

    const pageResponse = await responsePromise;
    expect(await pageResponse.text()).toBe('game asset');

    openCache({
      put: vi.fn(async (_request, response) => receiveCachedResponse(response)),
    });
    const cacheResponse = await cachedResponseReceived;
    expect(await cacheResponse.text()).toBe('game asset');
  });

  it('passes partial range responses through without trying to cache them', async () => {
    const listeners = new Map();
    const caches = {
      match: vi.fn(async () => undefined),
      open: vi.fn(),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
    };
    const self = {
      location: { origin: 'https://game.test', href: 'https://game.test/sw.js?v=13' },
      addEventListener: (name, listener) => listeners.set(name, listener),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn(async () => {}) },
    };
    const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    vm.runInNewContext(source, {
      self,
      caches,
      fetch: vi.fn(async () => new Response('part', {
        status: 206,
        headers: { 'Content-Range': 'bytes 0-3/10' },
      })),
      URL,
    });

    let responsePromise;
    listeners.get('fetch')({
      request: new Request('https://game.test/assets/music.mp3', {
        headers: { Range: 'bytes=0-3' },
      }),
      respondWith: (promise) => { responsePromise = promise; },
    });

    const response = await responsePromise;
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('part');
    expect(caches.open).not.toHaveBeenCalled();
  });

  it('unregisters an unversioned legacy worker without intercepting more requests', async () => {
    const listeners = new Map();
    const unregister = vi.fn(async () => true);
    const caches = {
      keys: vi.fn(async () => ['joel-football-v2', 'skyhead-showdown-audio-v1']),
      delete: vi.fn(async () => true),
    };
    const self = {
      location: { origin: 'https://game.test', href: 'https://game.test/sw.js' },
      registration: { unregister },
      addEventListener: (name, listener) => listeners.set(name, listener),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn(async () => {}) },
    };
    const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    vm.runInNewContext(source, { self, caches, URL });

    let activation;
    listeners.get('activate')({ waitUntil: (promise) => { activation = promise; } });
    await activation;

    expect(caches.delete).toHaveBeenCalledOnce();
    expect(caches.delete).toHaveBeenCalledWith('joel-football-v2');
    expect(unregister).toHaveBeenCalledOnce();

    const respondWith = vi.fn();
    listeners.get('fetch')({ respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
});

const ORIGIN = 'https://game.test/';
const absolute = (input) => (typeof input === 'string' ? new URL(input, ORIGIN).href : input.url);
class WorkerRequest extends Request {
  constructor(input, init) {
    super(typeof input === 'string' ? new URL(input, ORIGIN) : input, init);
  }
}
const createCacheStorage = () => {
  const stores = new Map();
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: async (input, response) => { store.set(absolute(input), response); },
      match: async (input) => store.get(absolute(input))?.clone(),
      addAll: async (requests) => {
        for (const request of requests) store.set(absolute(request), new Response(`body of ${absolute(request)}`));
      },
      keys: async () => [...store.keys()],
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (input) => {
      for (const store of stores.values()) {
        const hit = store.get(absolute(input));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
};
const loadWorker = async ({ manifest, caches, fetch = vi.fn(async () => { throw new TypeError('offline'); }), navigator = {} }) => {
  const listeners = new Map();
  const self = {
    location: { origin: 'https://game.test', href: 'https://game.test/sw.js?v=13' },
    addEventListener: (name, listener) => listeners.set(name, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
    navigator,
  };
  let source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  if (manifest) source = injectPrecacheManifest(source, manifest);
  vm.runInNewContext(source, { self, caches, fetch, URL, Request: WorkerRequest, Response });
  return { listeners, self, fetch };
};
const waitUntilOf = (listener, extra = {}) => {
  let pending;
  listener({ ...extra, waitUntil: (promise) => { pending = promise; } });
  return pending;
};

describe('offline precache (worker v13)', () => {
  const manifest = {
    build: 'abc123',
    core: ['./', 'manifest.webmanifest', 'assets/index-AAA.js', 'assets/phaser-BBB.js', 'assets/index-CCC.css'],
    media: ['assets/arena-neon.webp', 'assets/sound/GOAL_1.mp3'],
    music: ['assets/sound/track1.mp3'],
  };

  it('caches the shell and every hashed bundle at install, before any page asks for them', async () => {
    const caches = createCacheStorage();
    const { listeners } = await loadWorker({ manifest, caches });
    await waitUntilOf(listeners.get('install'));

    const cached = [...caches.stores.get('joel-football-v13-abc123').keys()];
    expect(cached).toEqual([
      'https://game.test/',
      'https://game.test/manifest.webmanifest',
      'https://game.test/assets/index-AAA.js',
      'https://game.test/assets/phaser-BBB.js',
      'https://game.test/assets/index-CCC.css',
    ]);
  });

  it('drops the previous build caches on activation but keeps the shared audio cache', async () => {
    const caches = createCacheStorage();
    await caches.open('joel-football-v12');
    await caches.open('joel-football-v13-oldbuild');
    await caches.open('skyhead-showdown-audio-v1');
    const { listeners, self } = await loadWorker({ manifest, caches });
    await waitUntilOf(listeners.get('install'));
    await waitUntilOf(listeners.get('activate'));

    expect([...caches.stores.keys()].sort()).toEqual(['joel-football-v13-abc123', 'skyhead-showdown-audio-v1']);
    expect(self.clients.claim).toHaveBeenCalledOnce();
  });

  it('fills art and sounds in the background, storing sounds in the game audio cache once', async () => {
    const caches = createCacheStorage();
    const audio = await caches.open('skyhead-showdown-audio-v1');
    await audio.put('assets/sound/GOAL_1.mp3', new Response('already warmed by the page'));
    const fetch = vi.fn(async (path) => new Response(`network ${path}`));
    const { listeners } = await loadWorker({ manifest, caches, fetch });
    await waitUntilOf(listeners.get('message'), { data: { type: 'precache-media' } });

    expect(fetch.mock.calls.map(([path]) => path).sort()).toEqual(['assets/arena-neon.webp', 'assets/sound/track1.mp3']);
    expect([...caches.stores.get('joel-football-v13-abc123').keys()]).toEqual(['https://game.test/assets/arena-neon.webp']);
    expect([...caches.stores.get('skyhead-showdown-audio-v1').keys()].sort()).toEqual([
      'https://game.test/assets/sound/GOAL_1.mp3',
      'https://game.test/assets/sound/track1.mp3',
    ]);
  });

  it('skips the music tracks when the browser asks to save data', async () => {
    const caches = createCacheStorage();
    const fetch = vi.fn(async (path) => new Response(`network ${path}`));
    const { listeners } = await loadWorker({ manifest, caches, fetch, navigator: { connection: { saveData: true } } });
    await waitUntilOf(listeners.get('message'), { data: { type: 'precache-media' } });

    expect(fetch.mock.calls.map(([path]) => path).sort()).toEqual(['assets/arena-neon.webp', 'assets/sound/GOAL_1.mp3']);
  });

  it('answers an offline media range request with a 206 slice of the cached file', async () => {
    const caches = createCacheStorage();
    const audio = await caches.open('skyhead-showdown-audio-v1');
    await audio.put('assets/sound/track1.mp3', new Response('0123456789', { headers: { 'Content-Type': 'audio/mpeg' } }));
    const { listeners, fetch } = await loadWorker({ manifest, caches });

    let responsePromise;
    listeners.get('fetch')({
      request: new Request('https://game.test/assets/sound/track1.mp3', { headers: { Range: 'bytes=2-5' } }),
      respondWith: (promise) => { responsePromise = promise; },
    });
    const response = await responsePromise;

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(await response.text()).toBe('2345');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shares its audio cache name with the in-game audio cache', async () => {
    const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    expect(source).toContain(`const AUDIO_CACHE_NAME = '${AUDIO_CACHE_NAME}';`);
  });
});

describe('precache manifest', () => {
  it('turns asset-naming template literals into file patterns and ignores open-ended ones', () => {
    const code = 'a=`power-icon-${n}.png`;b=`track${e+1}.mp3`;c=`${base}assets/${file}`;d=`${x}.png`';
    const patterns = templateAssetPatterns(code);
    const publicFiles = ['assets/power-icon-ice.png', 'assets/sound/track4.mp3', 'assets/player-nova.png', 'assets/ball.png'];
    expect(publicFiles.filter((file) => isReferenced(file, code, patterns))).toEqual([
      'assets/power-icon-ice.png',
      'assets/sound/track4.mp3',
    ]);
  });

  it('rejects a worker without the manifest markers', () => {
    expect(() => injectPrecacheManifest('const PRECACHE = {};', { build: 'x', core: [], media: [], music: [] })).toThrow(/markers/);
  });
});
