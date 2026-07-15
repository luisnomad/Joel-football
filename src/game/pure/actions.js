import { EMPTY_INTENT } from '../constants.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeIntent = (value = EMPTY_INTENT) => ({
  move: clamp(Number.isFinite(value.move) ? value.move : 0, -1, 1),
  jump: value.jump === true,
  kick: value.kick === true,
  lob: value.lob === true,
  dash: value.dash === true,
  dashDirection: Math.sign(clamp(Number.isFinite(value.dashDirection) ? value.dashDirection : 0, -1, 1)),
  power: value.power === true,
  kickBoost: Math.floor(clamp(Number.isFinite(value.kickBoost) ? value.kickBoost : 0, 0, 3)),
});

export const applyAiDifficulty = (intent, difficulty = 'normal') => {
  const safe = normalizeIntent(intent);
  return difficulty === 'easy' ? { ...safe, dash: false, dashDirection: 0, kickBoost: 0 } : safe;
};

export const safeDecide = (provider, snapshot) => {
  try {
    return normalizeIntent(provider?.decide?.(Object.freeze(snapshot)));
  } catch {
    return { ...EMPTY_INTENT };
  }
};
