import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

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
      location: { origin: 'https://game.test', href: 'https://game.test/sw.js?v=3' },
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
      location: { origin: 'https://game.test', href: 'https://game.test/sw.js?v=3' },
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
