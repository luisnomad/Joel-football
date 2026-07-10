import {
  consumeEquippedPower,
  createDefaultProfile,
  earnPower,
  equipPower,
  getMathLockRemaining,
  lockMathPractice,
  sanitizeProfile,
  setProfileAudio,
  setProfileDifficulty,
  setProfileLanguage,
} from '../pure/profile.js';

export const PROFILE_STORAGE_KEY = 'skyhead-showdown.player-profile.v2';

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readStoredProfile = (storage) => {
  if (!storage?.getItem) return createDefaultProfile();
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const profile = sanitizeProfile(parsed);
    if (!parsed?.audio && storage.getItem('skyhead-audio') === 'off') {
      return setProfileAudio(profile, { musicMuted: true, effectsMuted: true });
    }
    return profile;
  } catch {
    return createDefaultProfile();
  }
};

export const createPlayerProfileStore = (storage = defaultStorage()) => {
  let current = readStoredProfile(storage);

  const commit = (next) => {
    current = sanitizeProfile(next);
    try {
      storage?.setItem?.(PROFILE_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // The in-memory profile remains usable when storage is unavailable/full.
    }
    return sanitizeProfile(current);
  };

  return Object.freeze({
    get: () => sanitizeProfile(current),
    setLanguage: (language) => commit(setProfileLanguage(current, language)),
    setDifficulty: (difficulty) => commit(setProfileDifficulty(current, difficulty)),
    setAudio: (patch) => commit(setProfileAudio(current, patch)),
    earn: (powerId, amount = 1) => commit(earnPower(current, powerId, amount)),
    equip: (powerId) => commit(equipPower(current, powerId)),
    consumeEquipped: () => {
      const result = consumeEquippedPower(current);
      commit(result.profile);
      return result.consumedPowerId;
    },
    lockMath: (now = Date.now()) => commit(lockMathPractice(current, now)),
    getMathLockRemaining: (now = Date.now()) => getMathLockRemaining(current, now),
    clear: () => {
      try {
        storage?.removeItem?.(PROFILE_STORAGE_KEY);
      } catch {
        // Ignore storage failures and still reset the live profile.
      }
      current = createDefaultProfile();
      return sanitizeProfile(current);
    },
  });
};

export const playerProfileStore = createPlayerProfileStore();
