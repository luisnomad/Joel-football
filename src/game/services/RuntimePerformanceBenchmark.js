const percentile = (sortedValues, ratio) => {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1),
  );
  return sortedValues[index];
};

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
};

export const summarizeFrameTimes = (samples = []) => {
  const frameTimes = samples
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const totalMilliseconds = frameTimes.reduce((sum, value) => sum + value, 0);
  const medianFrame = percentile(frameTimes, 0.5);
  // A 60 Hz requestAnimationFrame interval normally lands slightly above
  // 16.666 ms, so a literal "> 16.7 ms" counter mostly measures timer jitter.
  // Treat a frame as missing a refresh when it takes at least 1.5 times the
  // observed median cadence. This also adapts to 90/120 Hz and 30 Hz devices.
  const missedRefreshThreshold = medianFrame * 1.5;
  const framesWithMissedRefresh = medianFrame > 0
    ? frameTimes.filter((value) => value > missedRefreshThreshold).length
    : 0;
  const estimatedMissedRefreshes = medianFrame > 0
    ? frameTimes.reduce(
      (sum, value) => sum + Math.max(0, Math.round(value / medianFrame) - 1),
      0,
    )
    : 0;
  return Object.freeze({
    samples: frameTimes.length,
    durationSeconds: round(totalMilliseconds / 1000),
    medianFrameMs: round(medianFrame),
    p95FrameMs: round(percentile(frameTimes, 0.95)),
    p99FrameMs: round(percentile(frameTimes, 0.99)),
    worstFrameMs: round(frameTimes.at(-1) ?? 0),
    medianFps: medianFrame > 0 ? round(1000 / medianFrame, 1) : 0,
    refreshIntervalMs: round(medianFrame),
    missedRefreshThresholdMs: round(missedRefreshThreshold),
    framesWithMissedRefresh,
    estimatedMissedRefreshes,
    framesOver33_3ms: frameTimes.filter((value) => value > 1000 / 30).length,
  });
};

export const estimateTextureResidency = (textureManager) => {
  const textures = textureManager?.getTextureKeys?.()
    .filter((key) => !key.startsWith('__'))
    .map((key) => {
      const texture = textureManager.get(key);
      const bytes = (texture?.source ?? []).reduce(
        (sum, source) => sum + (Number(source.width) || 0) * (Number(source.height) || 0) * 4,
        0,
      );
      return Object.freeze({ key, bytes });
    })
    .sort((a, b) => b.bytes - a.bytes) ?? [];
  return Object.freeze({
    textures: textures.length,
    estimatedDecodedMiB: round(
      textures.reduce((sum, texture) => sum + texture.bytes, 0) / (1024 ** 2),
    ),
    largest: textures.slice(0, 10).map(({ key, bytes }) => ({
      key,
      estimatedDecodedMiB: round(bytes / (1024 ** 2)),
    })),
  });
};

export const createRuntimePerformanceBenchmark = ({
  game,
  renderer = 'unknown',
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (handle) => cancelAnimationFrame(handle),
  isVisible = () => document.visibilityState !== 'hidden',
  maximumSamples = 36_000,
} = {}) => {
  let samples = [];
  let active = false;
  let lastTimestamp = null;
  let frameHandle = 0;

  const capture = (timestamp) => {
    if (!active) return;
    if (lastTimestamp !== null && isVisible()) {
      samples.push(Math.max(0, timestamp - lastTimestamp));
      if (samples.length > maximumSamples) samples.shift();
    }
    lastTimestamp = timestamp;
    frameHandle = requestFrame(capture);
  };

  const snapshot = () => Object.freeze({
    active,
    renderer,
    frames: summarizeFrameTimes(samples),
    residency: estimateTextureResidency(game?.textures),
  });

  return Object.freeze({
    start() {
      if (active) return snapshot();
      samples = [];
      lastTimestamp = null;
      active = true;
      frameHandle = requestFrame(capture);
      return snapshot();
    },
    stop() {
      active = false;
      if (frameHandle) cancelFrame(frameHandle);
      frameHandle = 0;
      lastTimestamp = null;
      return snapshot();
    },
    reset() {
      samples = [];
      lastTimestamp = null;
      return snapshot();
    },
    snapshot,
  });
};
