import { describe, expect, it } from 'vitest';
import {
  MATH_OPERATIONS,
  generateAnswerChoices,
  generateMathProblem,
  isCorrectAnswer,
} from '../src/game/pure/mathChallenge.js';
import {
  DEFAULT_AUDIO_SETTINGS,
  consumeEquippedPower,
  createDefaultProfile,
  earnPower,
  equipPower,
  getMathLockRemaining,
  lockMathPractice,
  sanitizeProfile,
  sanitizeAudioSettings,
  setProfileAudio,
  setProfileLanguage,
} from '../src/game/pure/profile.js';
import { normalizeLanguage, t } from '../src/game/i18n.js';
import { SUPERPOWERS, applySuperShot, getSuperpower } from '../src/game/content/superpowers.js';
import { createPlayerProfileStore } from '../src/game/services/PlayerProfile.js';
import { fitTextSize } from '../src/game/ui/textFit.js';
import { createAudioAssetCache } from '../src/game/services/AudioAssetCache.js';
import { AUDIO_ASSET_URLS, MUSIC_TRACKS } from '../src/game/services/ArcadeAudio.js';

const sequenceRandom = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe('math challenge generation', () => {
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
  it('starts bilingual-ready with ten empty powers and no equipped selection', () => {
    const profile = createDefaultProfile();
    expect(profile.language).toBe('en');
    expect(profile.equippedPowerId).toBeNull();
    expect(profile.mathLockUntil).toBe(0);
    expect(Object.keys(profile.powers)).toHaveLength(10);
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
    profile = earnPower(profile, 'lightning');
    profile = equipPower(profile, 'ice');
    const result = consumeEquippedPower(profile);
    expect(result.consumedPowerId).toBe('ice');
    expect(result.profile.powers.ice).toBe(0);
    expect(result.profile.powers.lightning).toBe(1);
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

describe('persistent audio settings', () => {
  it('starts at tablet-safe music and effects levels', () => {
    const profile = createDefaultProfile();
    expect(profile.version).toBe(3);
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

  it('defines six rotating music tracks and three supplied effects', () => {
    expect(MUSIC_TRACKS).toHaveLength(6);
    expect(AUDIO_ASSET_URLS).toHaveLength(9);
    expect(new Set(AUDIO_ASSET_URLS).size).toBe(9);
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

  it('survives a fresh store instance with charges, equipment, language, and penalty intact', () => {
    const storage = makeStorage();
    const firstSession = createPlayerProfileStore(storage);
    firstSession.setLanguage('es');
    firstSession.earn('rocket');
    firstSession.earn('rocket');
    firstSession.equip('rocket');
    firstSession.lockMath(50_000);
    firstSession.setAudio({ musicVolume: 0.35, effectsMuted: true });

    const refreshedSession = createPlayerProfileStore(storage);
    const restored = refreshedSession.get();
    expect(restored.language).toBe('es');
    expect(restored.powers.rocket).toBe(2);
    expect(restored.equippedPowerId).toBe('rocket');
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

describe('ten superpower shot contracts', () => {
  it('defines ten distinct powers with bilingual content keys', () => {
    expect(SUPERPOWERS).toHaveLength(10);
    expect(new Set(SUPERPOWERS.map(({ id }) => id)).size).toBe(10);
    expect(SUPERPOWERS.every(({ id }) => getSuperpower(id)?.nameKey === `power.${id}.name`)).toBe(true);
  });

  it('produces a distinct, mirrored modifier for every power', () => {
    const rightward = SUPERPOWERS.map(({ id }) => applySuperShot(id, { direction: 1, baseSpeed: 23 }));
    const leftward = SUPERPOWERS.map(({ id }) => applySuperShot(id, { direction: -1, baseSpeed: 23 }));
    expect(new Set(rightward.map(({ mechanic }) => mechanic)).size).toBe(10);
    rightward.forEach((shot, index) => {
      expect(shot.vx).toBeGreaterThan(0);
      expect(leftward[index].vx).toBeCloseTo(-shot.vx);
      expect(leftward[index].vy).toBe(shot.vy);
      expect(Number.isInteger(shot.color)).toBe(true);
    });
    expect(applySuperShot('lightning', { direction: 1, baseSpeed: 23 }).vx).toBeGreaterThan(
      applySuperShot('fireball', { direction: 1, baseSpeed: 23 }).vx,
    );
    expect(applySuperShot('rainbow', { direction: 1, baseSpeed: 23 }).vy).toBeLessThan(-12);
  });
});
