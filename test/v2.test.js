import { describe, expect, it } from 'vitest';
import {
  MATH_OPERATIONS,
  chooseMathOperation,
  generateAnswerChoices,
  generateMathProblem,
  isCorrectAnswer,
} from '../src/game/pure/mathChallenge.js';
import {
  DEFAULT_AUDIO_SETTINGS,
  PROFILE_VERSION,
  consumeEquippedPower,
  createDefaultProfile,
  earnPower,
  equipPower,
  getMathLockRemaining,
  lockMathPractice,
  sanitizeProfile,
  sanitizeAudioSettings,
  setProfileAudio,
  setProfileDifficulty,
  setProfileLanguage,
  setProfileOpponent,
  setProfilePlayerCharacter,
} from '../src/game/pure/profile.js';
import { normalizeLanguage, t } from '../src/game/i18n.js';
import { SUPERPOWERS, applySuperShot, getSuperpower } from '../src/game/content/superpowers.js';
import { createPlayerProfileStore, detectDeviceLanguage } from '../src/game/services/PlayerProfile.js';
import { fitTextSize } from '../src/game/ui/textFit.js';
import { createAudioAssetCache } from '../src/game/services/AudioAssetCache.js';
import { AUDIO_ASSET_URLS, MUSIC_TRACKS, WHISTLE_EFFECT_URL } from '../src/game/services/ArcadeAudio.js';
import { CHARACTERS, cycleCharacter, getCharacter, sanitizeLineup } from '../src/game/content/characters.js';
import {
  BIG_GUY_DURATION,
  activateBigGuy,
  createBigGuyState,
  stepBigGuy,
} from '../src/game/pure/bigGuy.js';

const sequenceRandom = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe('math challenge generation', () => {
  it('selects all four operation families uniformly from the random sample', () => {
    expect([
      chooseMathOperation(() => 0),
      chooseMathOperation(() => 0.25),
      chooseMathOperation(() => 0.5),
      chooseMathOperation(() => 0.999),
    ]).toEqual(MATH_OPERATIONS);
  });

  it('supports all four requested operations with child-friendly integer answers', () => {
    expect(MATH_OPERATIONS).toEqual(['addition', 'subtraction', 'multiplication', 'division']);

    for (const operation of MATH_OPERATIONS) {
      const problem = generateMathProblem(operation, sequenceRandom(0.2, 0.7, 0.4));
      expect(Number.isInteger(problem.answer)).toBe(true);
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      if (operation === 'subtraction') expect(problem.left).toBeGreaterThanOrEqual(problem.right);
      if (operation === 'division') {
        expect(problem.right).toBeGreaterThan(0);
        expect(problem.left % problem.right).toBe(0);
      }
      expect(isCorrectAnswer(problem, String(problem.answer))).toBe(true);
      expect(isCorrectAnswer(problem, String(problem.answer + 1))).toBe(false);
    }
  });

  it('uses age-nine operand ranges instead of single-digit beginner problems', () => {
    const addition = generateMathProblem('addition', sequenceRandom(0, 0));
    expect(addition.left).toBeGreaterThanOrEqual(10);
    expect(addition.right).toBeGreaterThanOrEqual(10);

    const subtraction = generateMathProblem('subtraction', sequenceRandom(0, 0));
    expect(subtraction.right).toBeGreaterThanOrEqual(10);
    expect(subtraction.answer).toBeGreaterThanOrEqual(10);

    const multiplication = generateMathProblem('multiplication', sequenceRandom(0, 0));
    expect(multiplication.left).toBeGreaterThanOrEqual(3);
    expect(multiplication.right).toBeGreaterThanOrEqual(3);
    expect(generateMathProblem('multiplication', sequenceRandom(0.999, 0.999)).left).toBe(12);

    const division = generateMathProblem('division', sequenceRandom(0, 0));
    expect(division.right).toBeGreaterThanOrEqual(3);
    expect(division.answer).toBeGreaterThanOrEqual(3);
    expect(generateMathProblem('division', sequenceRandom(0.999, 0.999)).left).toBe(144);
  });

  it('creates four unique non-negative choices containing the answer', () => {
    const choices = generateAnswerChoices(24, sequenceRandom(0.1, 0.9, 0.3, 0.7));
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain(24);
    expect(choices.every((choice) => Number.isInteger(choice) && choice >= 0)).toBe(true);
  });
});

describe('persistent power inventory rules', () => {
  it('starts bilingual-ready with five focused powers and no equipped selection', () => {
    const profile = createDefaultProfile();
    expect(profile.language).toBe('en');
    expect(profile.equippedPowerId).toBeNull();
    expect(profile.mathLockUntil).toBe(0);
    expect(Object.keys(profile.powers)).toHaveLength(5);
    expect(Object.values(profile.powers).every((count) => count === 0)).toBe(true);
  });

  it('earns immutable accumulating charges and equips only an earned power', () => {
    const original = createDefaultProfile();
    const rejected = equipPower(original, 'fireball');
    expect(rejected.equippedPowerId).toBeNull();

    const earnedOnce = earnPower(original, 'fireball');
    const earnedTwice = earnPower(earnedOnce, 'fireball');
    const equipped = equipPower(earnedTwice, 'fireball');
    expect(original.powers.fireball).toBe(0);
    expect(equipped.powers.fireball).toBe(2);
    expect(equipped.equippedPowerId).toBe('fireball');
  });

  it('consumes exactly one equipped charge and leaves all other powers intact', () => {
    let profile = earnPower(createDefaultProfile(), 'ice');
    profile = earnPower(profile, 'hyper');
    profile = equipPower(profile, 'ice');
    const result = consumeEquippedPower(profile);
    expect(result.consumedPowerId).toBe('ice');
    expect(result.profile.powers.ice).toBe(0);
    expect(result.profile.powers.hyper).toBe(1);
    expect(profile.powers.ice).toBe(1);
  });

  it('sanitizes corrupt persistence and accepts only English or Spanish', () => {
    const sanitized = sanitizeProfile({
      language: 'pirate',
      equippedPowerId: 'unknown',
      powers: { fireball: 3.8, ice: -9, unknown: 99 },
      mathLockUntil: -200,
    });
    expect(sanitized.language).toBe('en');
    expect(sanitized.equippedPowerId).toBeNull();
    expect(sanitized.powers.fireball).toBe(3);
    expect(sanitized.powers.ice).toBe(0);
    expect(sanitized.mathLockUntil).toBe(0);
    expect(normalizeLanguage('es')).toBe('es');
    expect(setProfileLanguage(sanitized, 'es').language).toBe('es');
    expect(setProfileLanguage(sanitized, 'es').languageSource).toBe('user');
  });

  it('migrates saved Rainbow charges and equipment into Big Guy', () => {
    const migrated = sanitizeProfile({
      version: 3,
      language: 'es',
      equippedPowerId: 'rainbow',
      powers: { rainbow: 4 },
    });
    expect(migrated.version).toBe(PROFILE_VERSION);
    expect(migrated.languageSource).toBe('user');
    expect(migrated.powers.big).toBe(4);
    expect(migrated.equippedPowerId).toBe('big');
    expect(migrated.powers).not.toHaveProperty('rainbow');
  });

  it('converts retired trick-shot charges and equipment into Fireball without losing inventory', () => {
    const migrated = sanitizeProfile({
      version: 5,
      equippedPowerId: 'warp',
      powers: { fireball: 2, lightning: 1, tornado: 2, rocket: 3, boomerang: 4, warp: 5 },
    });
    expect(migrated.version).toBe(PROFILE_VERSION);
    expect(migrated.equippedPowerId).toBe('fireball');
    expect(migrated.powers.fireball).toBe(17);
    expect(migrated.powers).not.toHaveProperty('warp');
  });

  it('persists a global five-minute lock after an incorrect answer', () => {
    const now = 1_000_000;
    const locked = lockMathPractice(createDefaultProfile(), now);
    expect(locked.mathLockUntil).toBe(now + 5 * 60 * 1_000);
    expect(getMathLockRemaining(locked, now)).toBe(5 * 60 * 1_000);
    expect(getMathLockRemaining(locked, now + 299_000)).toBe(1_000);
    expect(getMathLockRemaining(locked, now + 300_000)).toBe(0);
  });
});

describe('opponent selection', () => {
  it('offers every family character while skipping the character on the other side', () => {
    expect(CHARACTERS.map(({ id }) => id)).toEqual(['joel', 'bob', 'lucia', 'luna', 'juan', 'juanjo']);
    expect(cycleCharacter({ id: 'joel', direction: 1, excludedId: 'bob' }).id).toBe('lucia');
    expect(cycleCharacter({ id: 'joel', direction: -1, excludedId: 'bob' }).id).toBe('juanjo');
    expect(cycleCharacter({ id: 'lucia', direction: 1, excludedId: 'bob' }).id).toBe('luna');
    expect(getCharacter('unknown').id).toBe('joel');
    expect(CHARACTERS.map(({ id, nativeFacing }) => [id, nativeFacing])).toEqual([
      ['joel', 1],
      ['bob', -1],
      ['lucia', -1],
      ['luna', -1],
      ['juan', 1],
      ['juanjo', 1],
    ]);
    const validLineups = CHARACTERS.flatMap((player) => (
      CHARACTERS.filter((opponent) => opponent.id !== player.id)
        .map((opponent) => sanitizeLineup({ playerCharacterId: player.id, opponentId: opponent.id }))
    ));
    expect(validLineups).toHaveLength(30);
    expect(validLineups.every((lineup) => lineup.playerCharacterId !== lineup.opponentId)).toBe(true);
  });

  it('defaults and sanitizes a distinct persisted lineup', () => {
    expect(createDefaultProfile().playerCharacterId).toBe('joel');
    expect(createDefaultProfile().opponentId).toBe('bob');
    expect(setProfileOpponent(createDefaultProfile(), 'lucia').opponentId).toBe('lucia');
    expect(setProfilePlayerCharacter(createDefaultProfile(), 'lucia').playerCharacterId).toBe('lucia');
    expect(sanitizeProfile({ opponentId: 'unknown' }).opponentId).toBe('bob');
    expect(sanitizeLineup({ playerCharacterId: 'lucia', opponentId: 'lucia' })).toEqual({
      playerCharacterId: 'lucia',
      opponentId: 'joel',
    });
  });
});

describe('persistent audio settings', () => {
  it('starts at tablet-safe music and effects levels', () => {
    const profile = createDefaultProfile();
    expect(profile.version).toBe(PROFILE_VERSION);
    expect(profile.languageSource).toBe('device');
    expect(profile.audio).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(profile.audio.musicVolume).toBe(0.15);
    expect(profile.audio.effectsVolume).toBe(0.2);
  });

  it('clamps volumes to five-percent steps and keeps mute controls independent', () => {
    const sanitized = sanitizeAudioSettings({
      musicVolume: 1.8,
      effectsVolume: 0.326,
      musicMuted: true,
      effectsMuted: 'yes',
    });
    expect(sanitized).toEqual({
      musicVolume: 1,
      effectsVolume: 0.35,
      musicMuted: true,
      effectsMuted: false,
    });
    const updated = setProfileAudio(createDefaultProfile(), { effectsMuted: true, musicVolume: 0.4 });
    expect(updated.audio).toMatchObject({ musicVolume: 0.4, effectsVolume: 0.2, effectsMuted: true });
  });

  it('defines six rotating music tracks and caches the active whistle effect', () => {
    expect(MUSIC_TRACKS).toHaveLength(6);
    expect(AUDIO_ASSET_URLS).toHaveLength(9);
    expect(new Set(AUDIO_ASSET_URLS).size).toBe(9);
    expect(AUDIO_ASSET_URLS).toContain(WHISTLE_EFFECT_URL);
    expect(AUDIO_ASSET_URLS.some((url) => url.includes('bg_audience_goal'))).toBe(false);
  });
});

describe('persistent difficulty', () => {
  it('defaults to Normal, sanitizes invalid values, and persists Easy/Hard', () => {
    expect(createDefaultProfile().difficulty).toBe('normal');
    expect(sanitizeProfile({ difficulty: 'impossible' }).difficulty).toBe('normal');
    expect(setProfileDifficulty(createDefaultProfile(), 'easy').difficulty).toBe('easy');
    expect(setProfileDifficulty(createDefaultProfile(), 'hard').difficulty).toBe('hard');
  });
});

describe('audio asset cache', () => {
  it('fetches each asset once and returns reusable blob URLs', async () => {
    const entries = new Map();
    const cache = {
      match: async (url) => entries.get(url)?.clone(),
      put: async (url, response) => entries.set(url, response.clone()),
    };
    const cacheStorage = {
      open: async () => cache,
      keys: async () => ['skyhead-showdown-audio-old'],
      delete: async () => true,
    };
    let fetches = 0;
    const assetCache = createAudioAssetCache({
      cacheStorage,
      fetchAsset: async (url) => {
        fetches += 1;
        return new Response(`audio:${url}`, { status: 200 });
      },
      createObjectUrl: () => 'blob:cached-audio',
    });

    await assetCache.warm(['/a.mp3', '/b.mp3']);
    expect(fetches).toBe(2);
    expect(assetCache.diagnostics()).toEqual({ state: 'ready', cachedCount: 2 });
    expect(await assetCache.playableUrl('/a.mp3')).toBe('blob:cached-audio');
    expect(await assetCache.playableUrl('/a.mp3')).toBe('blob:cached-audio');
    expect(fetches).toBe(2);
  });
});

describe('local player profile storage', () => {
  const makeStorage = () => {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  };

  it('detects and immediately saves the primary tablet language only for a fresh profile', () => {
    const storage = makeStorage();
    const store = createPlayerProfileStore(storage, { languages: ['es-ES', 'en-US'], language: 'es-ES' });
    expect(store.get()).toMatchObject({ language: 'es', languageSource: 'device' });
    expect(JSON.parse(storage.getItem('skyhead-showdown.player-profile.v2'))).toMatchObject({
      language: 'es',
      languageSource: 'device',
      version: PROFILE_VERSION,
    });

    store.setLanguage('en');
    expect(store.get()).toMatchObject({ language: 'en', languageSource: 'user' });
    const reopened = createPlayerProfileStore(storage, { languages: ['es-ES'] });
    expect(reopened.get()).toMatchObject({ language: 'en', languageSource: 'user' });
  });

  it('preserves the language in older profiles instead of re-detecting it', () => {
    const storage = makeStorage();
    storage.setItem('skyhead-showdown.player-profile.v2', JSON.stringify({ version: 6, language: 'en' }));
    const migrated = createPlayerProfileStore(storage, { languages: ['es-ES'] }).get();
    expect(migrated).toMatchObject({ language: 'en', languageSource: 'user', version: PROFILE_VERSION });
  });

  it('supports Spanish locale families and safely falls back to English', () => {
    expect(detectDeviceLanguage({ language: 'es-MX' })).toBe('es');
    expect(detectDeviceLanguage({ languages: ['ca-ES', 'es-ES'] })).toBe('en');
    expect(detectDeviceLanguage({ language: 'fr-FR' })).toBe('en');
  });

  it('survives a fresh store instance with charges, equipment, language, opponent, difficulty, and penalty intact', () => {
    const storage = makeStorage();
    const firstSession = createPlayerProfileStore(storage);
    firstSession.setLanguage('es');
    firstSession.setDifficulty('hard');
    firstSession.setPlayerCharacter('lucia');
    firstSession.setOpponent('joel');
    firstSession.earn('hyper');
    firstSession.earn('hyper');
    firstSession.equip('hyper');
    firstSession.lockMath(50_000);
    firstSession.setAudio({ musicVolume: 0.35, effectsMuted: true });

    const refreshedSession = createPlayerProfileStore(storage);
    const restored = refreshedSession.get();
    expect(restored.language).toBe('es');
    expect(restored.difficulty).toBe('hard');
    expect(restored.playerCharacterId).toBe('lucia');
    expect(restored.opponentId).toBe('joel');
    expect(restored.powers.hyper).toBe(2);
    expect(restored.equippedPowerId).toBe('hyper');
    expect(restored.audio).toMatchObject({ musicVolume: 0.35, effectsMuted: true });
    expect(refreshedSession.getMathLockRemaining(50_000)).toBe(5 * 60 * 1_000);
  });

  it('consumes and persists one equipped charge only on explicit use', () => {
    const storage = makeStorage();
    const store = createPlayerProfileStore(storage);
    store.earn('shield');
    store.equip('shield');
    expect(store.get().powers.shield).toBe(1);
    expect(store.consumeEquipped()).toBe('shield');
    expect(createPlayerProfileStore(storage).get().powers.shield).toBe(0);
  });
});

describe('bilingual copy', () => {
  it('translates interface and power copy with safe English fallback', () => {
    expect(t('en', 'intro.play')).toBe('PLAY MATCH');
    expect(t('es', 'intro.play')).toBe('JUGAR PARTIDO');
    expect(t('es', 'power.fireball.name')).toBe('Bola de fuego');
    expect(t('en', 'power.big.name')).toBe('Big Guy!');
    expect(t('es', 'power.big.name')).toBe('¡Tío Grande!');
    expect(t('xx', 'intro.powerLab')).toBe('POWER LAB');
    expect(t('es', 'missing.key')).toBe('missing.key');
    expect(t('es', 'intro.touchSystem').split('\n')).toHaveLength(2);
  });
});

describe('localized button text fitting', () => {
  it('shrinks long Spanish labels while preserving the requested minimum size', () => {
    expect(fitTextSize({ measuredWidth: 180, maxWidth: 260, baseSize: 22 })).toBe(22);
    expect(fitTextSize({ measuredWidth: 340, maxWidth: 260, baseSize: 22 })).toBe(16);
    expect(fitTextSize({ measuredWidth: 900, maxWidth: 120, baseSize: 22, minSize: 12 })).toBe(12);
  });
});

describe('focused superpower contracts', () => {
  it('defines five distinct powers with explicit activation rules and bilingual content keys', () => {
    expect(SUPERPOWERS).toHaveLength(5);
    expect(new Set(SUPERPOWERS.map(({ id }) => id)).size).toBe(5);
    expect(SUPERPOWERS.every(({ id }) => getSuperpower(id)?.nameKey === `power.${id}.name`)).toBe(true);
    expect(SUPERPOWERS.filter(({ activation }) => activation === 'instant').map(({ id }) => id)).toEqual(['ice', 'shield', 'hyper']);
  });

  it('does not present Big Guy with a multiplier-like icon beside a zero charge count', () => {
    expect(getSuperpower('big').icon).not.toMatch(/[0-9×x]/i);
  });

  it('produces mirrored shots for the two ball-strike powers', () => {
    const shotPowers = SUPERPOWERS.filter(({ activation }) => activation === 'shot');
    const rightward = shotPowers.map(({ id }) => applySuperShot(id, { direction: 1, baseSpeed: 23 }));
    const leftward = shotPowers.map(({ id }) => applySuperShot(id, { direction: -1, baseSpeed: 23 }));
    expect(new Set(rightward.map(({ mechanic }) => mechanic)).size).toBe(2);
    rightward.forEach((shot, index) => {
      expect(shot.vx).toBeGreaterThan(0);
      expect(leftward[index].vx).toBeCloseTo(-shot.vx);
      expect(leftward[index].vy).toBe(shot.vy);
      expect(Number.isInteger(shot.color)).toBe(true);
    });
    expect(applySuperShot('fireball', { direction: 1, baseSpeed: 23 }).vx).toBeGreaterThan(23);
    expect(applySuperShot('big', { direction: 1, baseSpeed: 23 }).effect).toBe('big');
  });
});

describe('Big Guy transformation', () => {
  it('grows smoothly to 2×, stays active for ten seconds, and shrinks smoothly', () => {
    let state = activateBigGuy(createBigGuyState());
    expect(state.secondsRemaining).toBe(BIG_GUY_DURATION);
    state = stepBigGuy(state, 0.2);
    expect(state.scale).toBeGreaterThan(1);
    expect(state.scale).toBeLessThan(2);
    state = stepBigGuy(state, 0.2);
    expect(state.scale).toBe(2);
    state = stepBigGuy(state, 9.1);
    expect(state.scale).toBe(2);
    state = stepBigGuy(state, 0.2);
    expect(state.scale).toBeGreaterThan(1);
    expect(state.scale).toBeLessThan(2);
    state = stepBigGuy(state, 0.3);
    expect(state.secondsRemaining).toBeCloseTo(0);
    expect(state.scale).toBe(1);
  });
});
