import { EMPTY_INTENT } from '../constants.js';
import { normalizeIntent } from '../pure/actions.js';

export const createBufferedAsyncAgentProvider = ({
  id = 'buffered-async',
  type = 'ai',
  decideAsync,
  minIntervalMs = 250,
  requestTimeoutMs = 1200,
  now = () => Date.now(),
}) => {
  if (typeof decideAsync !== 'function') throw new TypeError('decideAsync must be a function');

  let cachedIntent = { ...EMPTY_INTENT };
  let inFlight = false;
  let lastStartedAt = Number.NEGATIVE_INFINITY;
  let generation = 0;
  let activeController = null;

  const requestDecision = (snapshot) => {
    inFlight = true;
    lastStartedAt = now();
    const ticket = ++generation;
    const controller = new AbortController();
    activeController = controller;
    let timeout;

    const timedOut = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('agent decision timed out'));
      }, requestTimeoutMs);
    });

    Promise.race([
      Promise.resolve().then(() => decideAsync(snapshot, { signal: controller.signal })),
      timedOut,
    ])
      .then((intent) => {
        if (ticket === generation) cachedIntent = normalizeIntent(intent);
      })
      .catch(() => {
        // Keep the last valid intent. Provider/network failures never stop play.
      })
      .finally(() => {
        clearTimeout(timeout);
        if (ticket === generation) {
          inFlight = false;
          activeController = null;
        }
      });
  };

  return {
    id,
    type,
    decide(snapshot) {
      if (!inFlight && now() - lastStartedAt >= minIntervalMs) requestDecision(snapshot);
      return { ...cachedIntent };
    },
    reset() {
      generation += 1;
      activeController?.abort();
      activeController = null;
      inFlight = false;
      lastStartedAt = Number.NEGATIVE_INFINITY;
      cachedIntent = { ...EMPTY_INTENT };
    },
  };
};
