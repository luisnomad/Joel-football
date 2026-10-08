import { SUPERPOWERS, getSuperpower } from '../content/superpowers.js';
import { DEFAULT_OPPONENT_ID, DEFAULT_PLAYER_CHARACTER_ID, sanitizeLineup } from '../content/characters.js';
import {
  DEFAULT_ARENA_THEME_ID,
  DEFAULT_BALL_TYPE_ID,
  sanitizeArenaThemeId,
  sanitizeBallTypeId,
} from '../content/matchCustomization.js';
import { MATH_BREAK_MS, sanitizeMathLevel, stepMathProgress } from './mathChallenge.js';

const emptyPowers = () => Object.fromEntries(SUPERPOWERS.map(({ id }) => [id, 0]));
const RETIRED_SHOT_POWERS = Object.freeze(['lightning', 'tornado', 'rocket', 'boomerang', 'warp']);

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  musicVolume: 0.15,
  effectsVolume: 0.2,
  musicMuted: false,
  effectsMuted: false,
});

export const DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard']);
export const GAME_IDS = Object.freeze(['football', 'kickfall', 'discHockey']);
export const PROFILE_VERSION = 13;
export const LANGUAGE_SOURCES = Object.freeze(['device', 'user']);
export const KICKFALL_MAX_LEVEL = 20;

export const sanitizeDifficulty = (value) => DIFFICULTIES.includes(value) ? value : 'normal';
export const sanitizeDifficultyByGame = (candidate, legacyDifficulty = 'normal') => ({
  football: sanitizeDifficulty(candidate?.football ?? legacyDifficulty),
  kickfall: sanitizeDifficulty(candidate?.kickfall),
  discHockey: sanitizeDifficulty(candidate?.discHockey),
});

export const DISC_HOCKEY_MODES = Object.freeze(['computer', 'local', 'crazy']);
export const DISC_HOCKEY_THEMES = Object.freeze(['ice', 'neon']);
export const sanitizeDiscHockeySettings = (candidate) => ({
  mode: DISC_HOCKEY_MODES.includes(candidate?.mode) ? candidate.mode : 'computer',
  themeId: DISC_HOCKEY_THEMES.includes(candidate?.themeId) ? candidate.themeId : 'ice',
});

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

/** Best Kickfall stars per level: { '1': 0..3, ... } for authored levels only. */
export const sanitizeKickfallStars = (candidate) => {
  const stars = {};
  if (!candidate || typeof candidate !== 'object') return stars;
  Object.entries(candidate).forEach(([key, value]) => {
    const level = Number(key);
    if (!Number.isInteger(level) || cleanKickfallLevel(level) !== level) return;
    const count = Math.min(3, Math.max(0, Math.floor(Number(value) || 0)));
    if (count > 0) stars[String(level)] = count;
  });
  return stars;
};

export const sanitizeKickfallProgress = (candidate) => {
  const highestUnlockedLevel = cleanKickfallLevel(candidate?.highestUnlockedLevel);
  return {
    highestUnlockedLevel,
    lastPlayedLevel: Math.min(highestUnlockedLevel, cleanKickfallLevel(candidate?.lastPlayedLevel)),
    stars: sanitizeKickfallStars(candidate?.stars),
  };
};

/**
 * Tile model for the Kickfall level select: every level with its best stars,
 * whether it can be played (up to the highest unlocked level) and whether it is
 * the saved continue level. Lives here (not with Kickfall) because the setup
 * menus are part of the opening payload.
 */
export const kickfallLevelTiles = (progress) => {
  const safe = sanitizeKickfallProgress(progress);
  return Array.from({ length: KICKFALL_MAX_LEVEL }, (_, index) => {
    const level = index + 1;
    return {
      level,
      unlocked: level <= safe.highestUnlockedLevel,
      stars: safe.stars[String(level)] ?? 0,
      current: level === safe.lastPlayedLevel,
    };
  });
};

/** Sum of best stars across every level (for the setup button and header). */
export const kickfallTotalStars = (progress) => (
  kickfallLevelTiles(progress).reduce((sum, tile) => sum + tile.stars, 0)
);

const cleanStreak = (value) => Math.min(99, Math.max(0, Math.floor(Number(value) || 0)));

/** Power Lab adaptive math progress (level plus answer streaks). */
export const sanitizeMathProgress = (candidate) => ({
  level: sanitizeMathLevel(candidate?.level),
  streak: cleanStreak(candidate?.streak),
  misses: cleanStreak(candidate?.misses),
  missRun: cleanStreak(candidate?.missRun),
  rightRun: cleanStreak(candidate?.rightRun),
});

export const createDefaultProfile = ({ language = 'en', languageSource = 'device' } = {}) => ({
  version: PROFILE_VERSION,
  language: language === 'es' ? 'es' : 'en',
  languageSource: LANGUAGE_SOURCES.includes(languageSource) ? languageSource : 'device',
  difficultyByGame: sanitizeDifficultyByGame(),
  playerCharacterId: DEFAULT_PLAYER_CHARACTER_ID,
  opponentId: DEFAULT_OPPONENT_ID,
  arenaThemeId: DEFAULT_ARENA_THEME_ID,
  ballTypeId: DEFAULT_BALL_TYPE_ID,
  equippedPowerId: null,
  mathLockUntil: 0,
  mathProgress: sanitizeMathProgress(),
  powers: emptyPowers(),
  audio: sanitizeAudioSettings(),
  kickfall: sanitizeKickfallProgress(),
  discHockey: sanitizeDiscHockeySettings(),
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
    difficultyByGame: sanitizeDifficultyByGame(candidate.difficultyByGame, candidate.difficulty),
    ...lineup,
    arenaThemeId: sanitizeArenaThemeId(candidate.arenaThemeId),
    ballTypeId: sanitizeBallTypeId(candidate.ballTypeId),
    equippedPowerId,
    mathLockUntil: Math.max(0, Math.floor(Number(candidate.mathLockUntil) || 0)),
    mathProgress: sanitizeMathProgress(candidate.mathProgress),
    powers,
    audio: sanitizeAudioSettings(candidate.audio),
    kickfall: sanitizeKickfallProgress(candidate.kickfall),
    discHockey: sanitizeDiscHockeySettings(candidate.discHockey),
  };
};

export const setDiscHockeySettings = (profile, patch) => {
  const safe = sanitizeProfile(profile);
  return {
    ...safe,
    discHockey: sanitizeDiscHockeySettings({ ...safe.discHockey, ...patch }),
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
      ...safe.kickfall,
      highestUnlockedLevel: requested,
      lastPlayedLevel: requested,
    },
  };
};

/** Total Kickfall stars earned across the campaign (max 3 per level). */
export const totalKickfallStars = (kickfall) => Object.values(sanitizeKickfallStars(kickfall?.stars))
  .reduce((sum, stars) => sum + stars, 0);

/** Keep the best star count earned on a Kickfall level. */
export const recordKickfallStars = (profile, level, stars) => {
  const safe = sanitizeProfile(profile);
  const key = String(cleanKickfallLevel(level));
  const best = Math.max(safe.kickfall.stars[key] ?? 0, Math.min(3, Math.max(0, Math.floor(Number(stars) || 0))));
  if (best === (safe.kickfall.stars[key] ?? 0)) return safe;
  return {
    ...safe,
    kickfall: { ...safe.kickfall, stars: { ...safe.kickfall.stars, [key]: best } },
  };
};

export const setProfileLanguage = (profile, language) => ({
  ...sanitizeProfile(profile),
  language: language === 'es' ? 'es' : 'en',
  languageSource: 'user',
});

export const setGameDifficulty = (profile, gameId, difficulty) => {
  const safe = sanitizeProfile(profile);
  if (!GAME_IDS.includes(gameId)) return safe;
  return {
    ...safe,
    difficultyByGame: {
      ...safe.difficultyByGame,
      [gameId]: sanitizeDifficulty(difficulty),
    },
  };
};

export const setProfileDifficulty = (profile, difficulty) => (
  setGameDifficulty(profile, 'football', difficulty)
);

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

/**
 * Records one Power Lab answer: adapts the level and starts a short break only
 * after several misses in a row (replaces the old five-minute lock per miss).
 */
export const recordMathAnswer = (profile, correct, now = Date.now()) => {
  const safe = sanitizeProfile(profile);
  const step = stepMathProgress(safe.mathProgress, Boolean(correct));
  const nowMs = Math.max(0, Math.floor(Number(now) || 0));
  return {
    profile: {
      ...safe,
      mathProgress: sanitizeMathProgress(step),
      mathLockUntil: step.takeBreak ? nowMs + MATH_BREAK_MS : safe.mathLockUntil,
    },
    outcome: {
      level: step.level,
      leveledUp: step.leveledUp,
      leveledDown: step.leveledDown,
      takeBreak: step.takeBreak,
      bonusCharge: step.bonusCharge,
      rightRun: step.rightRun,
    },
  };
};

export const lockMathPractice = (profile, now = Date.now(), durationMs = MATH_BREAK_MS) => ({
  ...sanitizeProfile(profile),
  mathLockUntil: Math.max(0, Math.floor(Number(now) || 0)) + Math.max(0, Math.floor(Number(durationMs) || 0)),
});

export const getMathLockRemaining = (profile, now = Date.now()) => Math.max(
  0,
  sanitizeProfile(profile).mathLockUntil - Math.max(0, Math.floor(Number(now) || 0)),
);
