import { EMPTY_INTENT } from '../constants.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeIntent = (value = EMPTY_INTENT) => ({
  move: clamp(Number.isFinite(value.move) ? value.move : 0, -1, 1),
  jump: value.jump === true,
  kick: value.kick === true,
  lob: value.lob === true,
  dash: value.dash === true,
  power: value.power === true,
});

export const safeDecide = (provider, snapshot) => {
  try {
    return normalizeIntent(provider?.decide?.(Object.freeze(snapshot)));
  } catch {
    return { ...EMPTY_INTENT };
  }
};
