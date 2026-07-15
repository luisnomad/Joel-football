import {
  consumeEquippedPower,
  createDefaultProfile,
  earnPower,
  equipPower,
  getMathLockRemaining,
  lockMathPractice,
  sanitizeProfile,
  setProfileAudio,
  setProfileArenaTheme,
  setProfileBallType,
  setProfileDifficulty,
  setProfileLanguage,
  setProfileOpponent,
  setProfilePlayerCharacter,
  setKickfallLastPlayed,
  unlockKickfallLevel,
} from '../pure/profile.js';

export const PROFILE_STORAGE_KEY = 'skyhead-showdown.player-profile.v2';

export const detectDeviceLanguage = (navigatorRef = globalThis.navigator) => {
  const candidates = [
    ...(Array.isArray(navigatorRef?.languages) ? navigatorRef.languages : []),
    navigatorRef?.language,
  ];
  const primary = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return primary?.toLowerCase().startsWith('es') ? 'es' : 'en';
};

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readStoredProfile = (storage, navigatorRef) => {
  const detected = () => createDefaultProfile({
    language: detectDeviceLanguage(navigatorRef),
    languageSource: 'device',
  });
  if (!storage?.getItem) return { profile: detected(), shouldPersist: false };
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const profile = parsed ? sanitizeProfile(parsed) : detected();
    if (!parsed?.audio && storage.getItem('skyhead-audio') === 'off') {
      return {
        profile: setProfileAudio(profile, { musicMuted: true, effectsMuted: true }),
        shouldPersist: true,
      };
    }
    return { profile, shouldPersist: !parsed || parsed.version !== profile.version };
  } catch {
    return { profile: detected(), shouldPersist: true };
  }
};

export const createPlayerProfileStore = (storage = defaultStorage(), navigatorRef = globalThis.navigator) => {
  const initial = readStoredProfile(storage, navigatorRef);
  let current = initial.profile;

  if (initial.shouldPersist) {
    try {
      storage?.setItem?.(PROFILE_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // The in-memory detected profile remains usable when storage is unavailable/full.
    }
  }

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
    setOpponent: (opponentId) => commit(setProfileOpponent(current, opponentId)),
    setPlayerCharacter: (characterId) => commit(setProfilePlayerCharacter(current, characterId)),
    setArenaTheme: (arenaThemeId) => commit(setProfileArenaTheme(current, arenaThemeId)),
    setBallType: (ballTypeId) => commit(setProfileBallType(current, ballTypeId)),
    setAudio: (patch) => commit(setProfileAudio(current, patch)),
    setKickfallLastPlayed: (level) => commit(setKickfallLastPlayed(current, level)),
    unlockKickfallLevel: (level) => commit(unlockKickfallLevel(current, level)),
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
      current = createDefaultProfile({
        language: detectDeviceLanguage(navigatorRef),
        languageSource: 'device',
      });
      try {
        storage?.setItem?.(PROFILE_STORAGE_KEY, JSON.stringify(current));
      } catch {
        // Keep the detected in-memory reset when persistence is unavailable.
      }
      return sanitizeProfile(current);
    },
  });
};

export const playerProfileStore = createPlayerProfileStore();
