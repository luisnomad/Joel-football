export const AUDIO_CACHE_NAME = 'skyhead-showdown-audio-v1';
const AUDIO_CACHE_PREFIX = 'skyhead-showdown-audio-';

const safeCacheStorage = () => {
  try {
    return globalThis.caches ?? null;
  } catch {
    return null;
  }
};

const safeFetch = (...args) => globalThis.fetch?.(...args);

export const createAudioAssetCache = ({
  cacheStorage = safeCacheStorage(),
  fetchAsset = safeFetch,
  createObjectUrl = (blob) => globalThis.URL?.createObjectURL?.(blob) ?? null,
  revokeObjectUrl = (url) => globalThis.URL?.revokeObjectURL?.(url),
} = {}) => {
  const objectUrls = new Map();
  const knownCachedUrls = new Set();
  let state = cacheStorage ? 'idle' : 'browser-cache';

  const open = async () => {
    if (!cacheStorage?.open) return null;
    return cacheStorage.open(AUDIO_CACHE_NAME);
  };

  const removeStaleCaches = async () => {
    if (!cacheStorage?.keys || !cacheStorage?.delete) return;
    try {
      const keys = await cacheStorage.keys();
      await Promise.all(keys
        .filter((key) => key.startsWith(AUDIO_CACHE_PREFIX) && key !== AUDIO_CACHE_NAME)
        .map((key) => cacheStorage.delete(key)));
    } catch {
      // Cache cleanup is an optimization; playback still uses the network cache.
    }
  };

  const has = async (url) => {
    const cache = await open();
    if (!cache) return false;
    try {
      const match = await cache.match(url);
      if (match) knownCachedUrls.add(url);
      return Boolean(match);
    } catch {
      return false;
    }
  };

  const cacheOne = async (url) => {
    const cache = await open();
    if (!cache || !fetchAsset) return false;
    try {
      const existing = await cache.match(url);
      if (existing) {
        knownCachedUrls.add(url);
        return true;
      }
      const response = await fetchAsset(url, { cache: 'force-cache' });
      if (!response?.ok) return false;
      await cache.put(url, response.clone());
      knownCachedUrls.add(url);
      return true;
    } catch {
      return false;
    }
  };

  const warm = async (urls, onProgress = () => {}) => {
    state = 'warming';
    await removeStaleCaches();
    for (const url of urls) {
      await cacheOne(url);
      onProgress(knownCachedUrls.size);
    }
    state = knownCachedUrls.size >= urls.length ? 'ready' : 'partial';
    return knownCachedUrls.size;
  };

  const playableUrl = async (url) => {
    if (objectUrls.has(url)) return objectUrls.get(url);
    const cache = await open();
    if (!cache) return url;
    try {
      let response = await cache.match(url);
      if (!response && await cacheOne(url)) response = await cache.match(url);
      if (!response) return url;
      knownCachedUrls.add(url);
      const objectUrl = createObjectUrl(await response.blob());
      if (!objectUrl) return url;
      objectUrls.set(url, objectUrl);
      return objectUrl;
    } catch {
      return url;
    }
  };

  const cachedPlayableUrl = async (url) => (
    await has(url) ? playableUrl(url) : url
  );

  const refreshCount = async (urls) => {
    await Promise.all(urls.map((url) => has(url)));
    return knownCachedUrls.size;
  };

  const dispose = () => {
    objectUrls.forEach((url) => revokeObjectUrl?.(url));
    objectUrls.clear();
  };

  return Object.freeze({
    cacheOne,
    cachedPlayableUrl,
    dispose,
    has,
    playableUrl,
    refreshCount,
    removeStaleCaches,
    warm,
    diagnostics: () => ({ state, cachedCount: knownCachedUrls.size }),
  });
};

export const audioAssetCache = createAudioAssetCache();
