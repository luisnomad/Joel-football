import { SUPERPOWERS, getSuperpower } from '../content/superpowers.js';
import { DEFAULT_OPPONENT_ID, DEFAULT_PLAYER_CHARACTER_ID, sanitizeLineup } from '../content/characters.js';
import {
  DEFAULT_ARENA_THEME_ID,
  DEFAULT_BALL_TYPE_ID,
  sanitizeArenaThemeId,
  sanitizeBallTypeId,
} from '../content/matchCustomization.js';

const emptyPowers = () => Object.fromEntries(SUPERPOWERS.map(({ id }) => [id, 0]));
const RETIRED_SHOT_POWERS = Object.freeze(['lightning', 'tornado', 'rocket', 'boomerang', 'warp']);

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  musicVolume: 0.15,
  effectsVolume: 0.2,
  musicMuted: false,
  effectsMuted: false,
});

export const DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard']);
export const PROFILE_VERSION = 11;
export const LANGUAGE_SOURCES = Object.freeze(['device', 'user']);
export const KICKFALL_MAX_LEVEL = 20;

export const sanitizeDifficulty = (value) => DIFFICULTIES.includes(value) ? value : 'normal';

const cleanVolume = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.min(1, Math.max(0, numeric)) * 20) / 20;
};

export const sanitizeAudioSettings = (candidate) => ({
  musicVolume: cleanVolume(candidate?.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
  effectsVolume: cleanVolume(candidate?.effectsVolume, DEFAULT_AUDIO_SETTINGS.effectsVolume),
  musicMuted: candidate?.musicMuted === true,
  effectsMuted: candidate?.effectsMuted === true,
});

const cleanKickfallLevel = (value) => Math.min(
  KICKFALL_MAX_LEVEL,
  Math.max(1, Math.floor(Number(value) || 1)),
);

export const sanitizeKickfallProgress = (candidate) => {
  const highestUnlockedLevel = cleanKickfallLevel(candidate?.highestUnlockedLevel);
  return {
    highestUnlockedLevel,
    lastPlayedLevel: Math.min(highestUnlockedLevel, cleanKickfallLevel(candidate?.lastPlayedLevel)),
  };
};

export const createDefaultProfile = ({ language = 'en', languageSource = 'device' } = {}) => ({
  version: PROFILE_VERSION,
  language: language === 'es' ? 'es' : 'en',
  languageSource: LANGUAGE_SOURCES.includes(languageSource) ? languageSource : 'device',
  difficulty: 'normal',
  playerCharacterId: DEFAULT_PLAYER_CHARACTER_ID,
  opponentId: DEFAULT_OPPONENT_ID,
  arenaThemeId: DEFAULT_ARENA_THEME_ID,
  ballTypeId: DEFAULT_BALL_TYPE_ID,
  equippedPowerId: null,
  mathLockUntil: 0,
  powers: emptyPowers(),
  audio: sanitizeAudioSettings(),
  kickfall: sanitizeKickfallProgress(),
});

const cleanCount = (value) => Math.min(999, Math.max(0, Math.floor(Number(value) || 0)));

export const sanitizeProfile = (candidate) => {
  const fallback = createDefaultProfile();
  if (!candidate || typeof candidate !== 'object') return fallback;
  const powers = emptyPowers();
  SUPERPOWERS.forEach(({ id }) => {
    const legacyValue = id === 'big' ? candidate.powers?.rainbow : undefined;
    powers[id] = cleanCount(candidate.powers?.[id] ?? legacyValue);
  });
  const retiredCharges = RETIRED_SHOT_POWERS.reduce(
    (total, id) => total + cleanCount(candidate.powers?.[id]),
    0,
  );
  powers.fireball = cleanCount(powers.fireball + retiredCharges);
  const legacyEquippedPowerId = candidate.equippedPowerId === 'rainbow' ? 'big' : candidate.equippedPowerId;
  const migratedEquippedPowerId = RETIRED_SHOT_POWERS.includes(legacyEquippedPowerId)
    ? 'fireball'
    : legacyEquippedPowerId;
  const equippedPowerId = getSuperpower(migratedEquippedPowerId) ? migratedEquippedPowerId : null;
  const lineup = sanitizeLineup(candidate);
  return {
    version: PROFILE_VERSION,
    language: candidate.language === 'es' ? 'es' : 'en',
    languageSource: LANGUAGE_SOURCES.includes(candidate.languageSource)
      ? candidate.languageSource
      : 'user',
    difficulty: sanitizeDifficulty(candidate.difficulty),
    ...lineup,
    arenaThemeId: sanitizeArenaThemeId(candidate.arenaThemeId),
    ballTypeId: sanitizeBallTypeId(candidate.ballTypeId),
    equippedPowerId,
    mathLockUntil: Math.max(0, Math.floor(Number(candidate.mathLockUntil) || 0)),
    powers,
    audio: sanitizeAudioSettings(candidate.audio),
    kickfall: sanitizeKickfallProgress(candidate.kickfall),
  };
};

export const setKickfallLastPlayed = (profile, level) => {
  const safe = sanitizeProfile(profile);
  return {
    ...safe,
    kickfall: {
      ...safe.kickfall,
      lastPlayedLevel: Math.min(safe.kickfall.highestUnlockedLevel, cleanKickfallLevel(level)),
    },
  };
};

export const unlockKickfallLevel = (profile, level) => {
  const safe = sanitizeProfile(profile);
  const requested = cleanKickfallLevel(level);
  if (requested <= safe.kickfall.highestUnlockedLevel) return safe;
  return {
    ...safe,
    kickfall: {
      highestUnlockedLevel: requested,
      lastPlayedLevel: requested,
    },
  };
};

export const setProfileLanguage = (profile, language) => ({
  ...sanitizeProfile(profile),
  language: language === 'es' ? 'es' : 'en',
  languageSource: 'user',
});

export const setProfileDifficulty = (profile, difficulty) => ({
  ...sanitizeProfile(profile),
  difficulty: sanitizeDifficulty(difficulty),
});

export const setProfileOpponent = (profile, opponentId) => ({
  ...sanitizeProfile(profile),
  ...sanitizeLineup({ ...sanitizeProfile(profile), opponentId }),
});

export const setProfilePlayerCharacter = (profile, playerCharacterId) => ({
  ...sanitizeProfile(profile),
  ...sanitizeLineup({ ...sanitizeProfile(profile), playerCharacterId }),
});

export const setProfileArenaTheme = (profile, arenaThemeId) => ({
  ...sanitizeProfile(profile),
  arenaThemeId: sanitizeArenaThemeId(arenaThemeId),
});

export const setProfileBallType = (profile, ballTypeId) => ({
  ...sanitizeProfile(profile),
  ballTypeId: sanitizeBallTypeId(ballTypeId),
});

export const setProfileAudio = (profile, patch) => {
  const safe = sanitizeProfile(profile);
  return {
    ...safe,
    audio: sanitizeAudioSettings({ ...safe.audio, ...patch }),
  };
};

export const earnPower = (profile, powerId, amount = 1) => {
  const safe = sanitizeProfile(profile);
  if (!getSuperpower(powerId)) return safe;
  const increment = Math.max(0, Math.floor(Number(amount) || 0));
  return {
    ...safe,
    powers: {
      ...safe.powers,
      [powerId]: cleanCount(safe.powers[powerId] + increment),
    },
  };
};

export const equipPower = (profile, powerId) => {
  const safe = sanitizeProfile(profile);
  if (!getSuperpower(powerId) || safe.powers[powerId] <= 0) return safe;
  return { ...safe, equippedPowerId: powerId };
};

export const consumeEquippedPower = (profile) => {
  const safe = sanitizeProfile(profile);
  const powerId = safe.equippedPowerId;
  if (!powerId || safe.powers[powerId] <= 0) return { profile: safe, consumedPowerId: null };
  return {
    profile: {
      ...safe,
      powers: { ...safe.powers, [powerId]: safe.powers[powerId] - 1 },
    },
    consumedPowerId: powerId,
  };
};

export const lockMathPractice = (profile, now = Date.now(), durationMs = 5 * 60 * 1_000) => ({
  ...sanitizeProfile(profile),
  mathLockUntil: Math.max(0, Math.floor(Number(now) || 0)) + Math.max(0, Math.floor(Number(durationMs) || 0)),
});

export const getMathLockRemaining = (profile, now = Date.now()) => Math.max(
  0,
  sanitizeProfile(profile).mathLockUntil - Math.max(0, Math.floor(Number(now) || 0)),
);
