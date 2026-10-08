import { describe, expect, it } from 'vitest';
import { kickfallLevelTiles, kickfallTotalStars } from '../src/game/pure/profile.js';
import { BALL_TYPES } from '../src/game/content/matchCustomization.js';
import {
  BALL_BOUNCE_COOLDOWN,
  BALL_BOUNCE_MIN_SPEED,
  ballBounceStrength,
  resolveBallImpactProfile,
} from '../src/game/pure/ballImpactFeedback.js';
import {
  chooseKickfallFollowTarget,
  isKickfallFollowAssistEnabled,
} from '../src/game/minigames/kickfall/kickfallAssist.js';
import { KICKFALL_MAX_LEVEL } from '../src/game/pure/profile.js';
import { bakedTintKey } from '../src/game/effects/bakedTint.js';
import {
  BIG_GUY_POP_SECONDS,
  STATUS_HALO_COLORS,
  bigGuyPopProgress,
  fighterStatusVisual,
} from '../src/game/pure/fighterStatusVisual.js';
import {
  DEFAULT_MATH_LEVEL,
  MATH_BREAK_AFTER_MISSES,
  MATH_BREAK_MS,
  MATH_LEVELS,
  chooseMathOperation,
  explainMathProblem,
  generateAnswerChoices,
  generateMathProblem,
  mathLevelOperations,
  stepMathProgress,
} from '../src/game/pure/mathChallenge.js';
import {
  createDefaultProfile,
  getMathLockRemaining,
  recordMathAnswer,
  sanitizeProfile,
} from '../src/game/pure/profile.js';
import {
  BALL_SHADOW_FADE_HEIGHT,
  BALL_SHADOW_MAX_ALPHA,
  BALL_SHADOW_MIN_ALPHA,
  BALL_SHADOW_MIN_SCALE,
  ballShadowAt,
  ballShadowCenterY,
} from '../src/game/pure/ballShadow.js';

describe('ball ground shadow', () => {
  it('is largest and darkest with the ball on the pitch', () => {
    const grounded = ballShadowAt({ ballY: 614, groundY: 636, radius: 22 });
    expect(grounded.height).toBe(0);
    expect(grounded.alpha).toBe(BALL_SHADOW_MAX_ALPHA);
    expect(grounded.width).toBeCloseTo(22 * 2.8);
  });

  it('shrinks and fades as the ball rises, then holds its minimum', () => {
    const low = ballShadowAt({ ballY: 500, groundY: 636, radius: 22 });
    const high = ballShadowAt({ ballY: 300, groundY: 636, radius: 22 });
    expect(high.width).toBeLessThan(low.width);
    expect(high.alpha).toBeLessThan(low.alpha);
    const top = ballShadowAt({ ballY: 636 - 22 - BALL_SHADOW_FADE_HEIGHT, groundY: 636, radius: 22 });
    const beyond = ballShadowAt({ ballY: -200, groundY: 636, radius: 22 });
    expect(top.alpha).toBeCloseTo(BALL_SHADOW_MIN_ALPHA);
    expect(top.width).toBeCloseTo(22 * 2.8 * BALL_SHADOW_MIN_SCALE);
    expect(beyond).toMatchObject({ alpha: top.alpha, width: top.width });
  });

  it('sits on the grass above the pitch edge line, not centred on it', () => {
    const { depth } = ballShadowAt({ ballY: 614, groundY: 636, radius: 22 });
    // Bottom edge on the painted grass (which ends ~14 px above the ground line).
    expect(ballShadowCenterY({ groundY: 636, depth }) + depth / 2).toBeLessThanOrEqual(622);
  });

  it('scales with the ball size', () => {
    expect(ballShadowAt({ ballY: 609, groundY: 636, radius: 27 }).width).toBeGreaterThan(
      ballShadowAt({ ballY: 614, groundY: 636, radius: 22 }).width,
    );
  });
});

/** Deterministic pseudo-random sequence (mulberry32) for repeatable sweeps. */
const seeded = (seed) => () => {
  let value = (seed += 0x6d2b79f5);
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

describe('level-appropriate math (audit E1)', () => {
  it('offers easier operation families at lower levels', () => {
    expect(MATH_LEVELS).toEqual(['starter', 'explorer', 'champion']);
    expect(mathLevelOperations('starter')).toEqual(['addition', 'subtraction']);
    expect(mathLevelOperations('explorer')).toEqual(['addition', 'subtraction', 'multiplication']);
    expect(mathLevelOperations('champion')).toEqual(['addition', 'subtraction', 'multiplication', 'division']);
    expect(mathLevelOperations('nonsense')).toEqual(mathLevelOperations(DEFAULT_MATH_LEVEL));
  });

  it('keeps every level inside its ranges with whole, non-negative answers', () => {
    const random = seeded(7);
    for (const level of MATH_LEVELS) {
      for (let index = 0; index < 600; index += 1) {
        const operation = chooseMathOperation(random, level);
        const problem = generateMathProblem(operation, random, level);
        expect(Number.isInteger(problem.answer)).toBe(true);
        expect(problem.answer).toBeGreaterThanOrEqual(0);
        expect(problem.level).toBe(level);
        if (level === 'starter') {
          expect(['addition', 'subtraction']).toContain(problem.operation);
          expect(Math.max(problem.left, problem.right, problem.answer)).toBeLessThanOrEqual(20);
        } else if (level === 'explorer') {
          expect(problem.operation).not.toBe('division');
          if (problem.operation === 'multiplication') {
            expect([2, 5, 10].some((table) => problem.left === table || problem.right === table)).toBe(true);
          } else {
            expect(Math.max(problem.left, problem.right, problem.answer)).toBeLessThanOrEqual(99);
          }
        }
        if (problem.operation === 'subtraction') expect(problem.left).toBeGreaterThanOrEqual(problem.right);
        if (problem.operation === 'division') expect(problem.left % problem.right).toBe(0);
      }
    }
  });

  it('keeps champion as the original age-nine set', () => {
    const random = seeded(11);
    for (let index = 0; index < 300; index += 1) {
      const problem = generateMathProblem('addition', random, 'champion');
      expect(problem.left).toBeGreaterThanOrEqual(10);
      expect(problem.right).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('answer choices (audit E2)', () => {
  it('always has four unique, valid choices including the answer', () => {
    const random = seeded(3);
    for (const level of MATH_LEVELS) {
      for (let index = 0; index < 500; index += 1) {
        const problem = generateMathProblem(chooseMathOperation(random, level), random, level);
        const choices = generateAnswerChoices(problem, random);
        expect(choices).toHaveLength(4);
        expect(new Set(choices).size).toBe(4);
        expect(choices).toContain(problem.answer);
        expect(choices.every((choice) => Number.isInteger(choice) && choice >= 0)).toBe(true);
      }
    }
  });

  it('does not give the answer away by position or by being the middle value', () => {
    const random = seeded(5);
    const positions = [0, 0, 0, 0];
    const ranks = [0, 0, 0, 0];
    let consecutiveRuns = 0;
    const total = 4000;
    for (let index = 0; index < total; index += 1) {
      const level = MATH_LEVELS[index % 3];
      const problem = generateMathProblem(chooseMathOperation(random, level), random, level);
      const choices = generateAnswerChoices(problem, random);
      positions[choices.indexOf(problem.answer)] += 1;
      const sorted = [...choices].sort((a, b) => a - b);
      ranks[sorted.indexOf(problem.answer)] += 1;
      if (sorted[3] - sorted[0] === 3) consecutiveRuns += 1;
    }
    positions.forEach((count) => expect(count / total).toBeGreaterThan(0.18));
    // Every rank (smallest .. largest) happens often enough to defeat "pick the middle".
    ranks.forEach((count) => expect(count / total).toBeGreaterThan(0.1));
    // The old generator produced four consecutive numbers almost every time.
    expect(consecutiveRuns / total).toBeLessThan(0.05);
  });

  it('includes realistic mistakes: a forgotten carry and a neighbouring table fact', () => {
    const carry = generateAnswerChoices({ operation: 'addition', left: 48, right: 37, answer: 85 }, seeded(1));
    expect(carry).toContain(75);
    const table = generateAnswerChoices({ operation: 'multiplication', left: 7, right: 8, answer: 56 }, seeded(1));
    expect(table.some((choice) => [64, 48, 63, 49].includes(choice))).toBe(true);
  });
});

describe('wrong-answer explanations (audit E3)', () => {
  it('picks a visual that fits the problem', () => {
    expect(explainMathProblem({ operation: 'addition', left: 7, right: 5, answer: 12 }).kind).toBe('dots');
    expect(explainMathProblem({ operation: 'subtraction', left: 15, right: 6, answer: 9 }).kind).toBe('dots');
    expect(explainMathProblem({ operation: 'addition', left: 48, right: 37, answer: 85 })).toMatchObject({
      kind: 'tensOnes', rightTens: 30, rightOnes: 7, middle: 78,
    });
    expect(explainMathProblem({ operation: 'subtraction', left: 52, right: 17, answer: 35 })).toMatchObject({
      kind: 'tensOnes', rightTens: 10, rightOnes: 7, middle: 42,
    });
    expect(explainMathProblem({ operation: 'multiplication', left: 6, right: 7, answer: 42 })).toMatchObject({
      kind: 'skipCount', row: [7, 14, 21, 28, 35, 42],
    });
    expect(explainMathProblem({ operation: 'division', left: 56, right: 8, answer: 7 }).kind).toBe('inverse');
  });
});

describe('adaptive level and short break (audit E1/E3)', () => {
  it('moves up after three right in a row and down after two misses', () => {
    let state = { level: 'starter', streak: 0, misses: 0, missRun: 0 };
    state = stepMathProgress(state, true);
    state = stepMathProgress(state, true);
    expect(state.level).toBe('starter');
    state = stepMathProgress(state, true);
    expect(state).toMatchObject({ level: 'explorer', leveledUp: true, streak: 0 });
    state = stepMathProgress(state, false);
    expect(state.level).toBe('explorer');
    state = stepMathProgress(state, false);
    expect(state).toMatchObject({ level: 'starter', leveledDown: true });
  });

  it('drops only one level per two misses and breaks only after three in a row', () => {
    let state = { level: 'champion', streak: 0, misses: 0, missRun: 0 };
    const outcomes = [];
    for (let miss = 0; miss < MATH_BREAK_AFTER_MISSES; miss += 1) {
      state = stepMathProgress(state, false);
      outcomes.push({ level: state.level, takeBreak: state.takeBreak });
    }
    expect(outcomes).toEqual([
      { level: 'champion', takeBreak: false },
      { level: 'explorer', takeBreak: false },
      { level: 'explorer', takeBreak: true },
    ]);
    // A right answer clears the run.
    expect(stepMathProgress({ level: 'explorer', missRun: 2 }, true).missRun).toBe(0);
  });

  it('persists progress in the profile and only locks for the short break', () => {
    const now = 5_000_000;
    let profile = createDefaultProfile();
    expect(profile.mathProgress).toEqual({ level: DEFAULT_MATH_LEVEL, streak: 0, misses: 0, missRun: 0, rightRun: 0 });
    let result = recordMathAnswer(profile, false, now);
    expect(getMathLockRemaining(result.profile, now)).toBe(0);
    result = recordMathAnswer(result.profile, false, now);
    expect(getMathLockRemaining(result.profile, now)).toBe(0);
    result = recordMathAnswer(result.profile, false, now);
    expect(result.outcome.takeBreak).toBe(true);
    expect(getMathLockRemaining(result.profile, now)).toBe(MATH_BREAK_MS);
    profile = sanitizeProfile(JSON.parse(JSON.stringify(result.profile)));
    expect(profile.mathProgress.level).toBe(result.profile.mathProgress.level);
  });

  it('sanitizes missing or corrupt saved progress (existing profiles)', () => {
    expect(sanitizeProfile({ language: 'en' }).mathProgress).toEqual({ level: DEFAULT_MATH_LEVEL, streak: 0, misses: 0, missRun: 0, rightRun: 0 });
    expect(sanitizeProfile({ mathProgress: { level: 'wizard', streak: -4, misses: 2.7, missRun: 'x', rightRun: 'lots' } }).mathProgress)
      .toEqual({ level: DEFAULT_MATH_LEVEL, streak: 0, misses: 2, missRun: 0, rightRun: 0 });
  });

  it('awards a streak bonus on every third right answer in a row, across level changes (audit E4)', () => {
    let profile = sanitizeProfile({ language: 'en' });
    const now = 1_000_000;
    const bonuses = [];
    for (let answer = 0; answer < 7; answer += 1) {
      const result = recordMathAnswer(profile, true, now);
      bonuses.push(result.outcome.bonusCharge);
      profile = result.profile;
    }
    // Third, sixth: bonus — even though the third answer also levels up.
    expect(bonuses).toEqual([false, false, true, false, false, true, false]);
    expect(profile.mathProgress.rightRun).toBe(7);
    // A miss resets the run.
    const missed = recordMathAnswer(profile, false, now);
    expect(missed.profile.mathProgress.rightRun).toBe(0);
    expect(missed.outcome.bonusCharge).toBe(false);
    expect(sanitizeProfile(JSON.parse(JSON.stringify(missed.profile))).mathProgress.rightRun).toBe(0);
  });
});

describe('visible power states under Canvas (audit A1/B5)', () => {
  it('shows nothing without a status', () => {
    expect(fighterStatusVisual()).toEqual({
      halo: null, haloColor: null, iceBlock: false, shieldBubble: false, speedLines: false,
    });
  });

  it('draws an ice block on a frozen rival and nothing that suggests other powers', () => {
    const visual = fighterStatusVisual({ freezeTimer: 3, shieldTimer: 2, hyperTimer: 2, chilenaActive: true });
    expect(visual).toMatchObject({ halo: 'frozen', iceBlock: true, shieldBubble: false, speedLines: false });
  });

  it('gives shield, hyper, Big Guy, armed power and chilena their own look', () => {
    expect(fighterStatusVisual({ shieldTimer: 1 })).toMatchObject({ halo: 'shield', shieldBubble: true });
    expect(fighterStatusVisual({ hyperTimer: 1 })).toMatchObject({ halo: 'hyper', speedLines: true });
    expect(fighterStatusVisual({ bigGuyActive: true }).halo).toBe('bigGuy');
    expect(fighterStatusVisual({ powerArmed: 1, side: 'left' }).halo).toBe('armedLeft');
    expect(fighterStatusVisual({ powerArmed: 1, side: 'right' }).halo).toBe('armedRight');
    expect(fighterStatusVisual({ chilenaActive: true, hyperTimer: 1 })).toMatchObject({ halo: 'chilena', speedLines: true });
    expect(new Set(Object.values(STATUS_HALO_COLORS)).size).toBe(Object.keys(STATUS_HALO_COLORS).length);
  });

  it('pops Big Guy briefly when the power starts', () => {
    expect(bigGuyPopProgress(0)).toBe(0);
    expect(bigGuyPopProgress(BIG_GUY_POP_SECONDS / 2)).toBeCloseTo(0.5);
    expect(bigGuyPopProgress(BIG_GUY_POP_SECONDS)).toBeNull();
    expect(bigGuyPopProgress(Infinity)).toBeNull();
    expect(bigGuyPopProgress(-1)).toBeNull();
  });

  it('caches one baked texture per source, frame, colour and mode', () => {
    expect(bakedTintKey('kickfall-bumper', '__BASE', 0xff3d58, 'fill')).toBe('kickfall-bumper~fill-ff3d58');
    expect(bakedTintKey('control-kick', undefined, 0xffdc72, 'multiply')).toBe('control-kick~multiply-ffdc72');
    expect(bakedTintKey('sheet', 3, 0x0000ff, 'multiply')).toBe('sheet:3~multiply-0000ff');
  });
});

describe('per-ball impact feedback (batch 3, F3)', () => {
  it('gives every ball type its own bounce and kick feel', () => {
    const profiles = BALL_TYPES.map((type) => resolveBallImpactProfile(type));
    expect(profiles.map((profile) => profile.id)).toEqual([
      'football', 'neon-ball', 'balloon', 'rugby', 'can', 'cannonball',
    ]);
    expect(new Set(profiles.map((profile) => profile.bounceTone.frequency)).size).toBe(BALL_TYPES.length);
    profiles.forEach((profile) => {
      expect(profile.particles.count).toBeGreaterThan(0);
      profile.particles.colors.forEach((color) => expect(Number.isInteger(color)).toBe(true));
    });
    expect(resolveBallImpactProfile({ id: 'mystery', family: 'unknown' }).id).toBe('football');
    expect(resolveBallImpactProfile(undefined).id).toBe('football');
  });

  it('only rewards real bounces, scaled by speed and throttled', () => {
    expect(ballBounceStrength({ downwardSpeed: BALL_BOUNCE_MIN_SPEED - 0.1 })).toBe(0);
    expect(ballBounceStrength({ downwardSpeed: -12 })).toBe(0);
    expect(ballBounceStrength({ downwardSpeed: Number.NaN })).toBe(0);
    expect(ballBounceStrength({ downwardSpeed: BALL_BOUNCE_MIN_SPEED })).toBe(0.25);
    expect(ballBounceStrength({ downwardSpeed: 10 })).toBeCloseTo(0.5, 5);
    expect(ballBounceStrength({ downwardSpeed: 40 })).toBe(1);
    expect(ballBounceStrength({ downwardSpeed: 12, sinceLastBounce: BALL_BOUNCE_COOLDOWN / 2 })).toBe(0);
    expect(ballBounceStrength({ downwardSpeed: 12, sinceLastBounce: BALL_BOUNCE_COOLDOWN })).toBeGreaterThan(0);
  });
});

describe('Kickfall follow-the-ball assist (batch 3, H3)', () => {
  it('is on for Easy only', () => {
    expect(isKickfallFollowAssistEnabled('easy')).toBe(true);
    expect(isKickfallFollowAssistEnabled('normal')).toBe(false);
    expect(isKickfallFollowAssistEnabled('hard')).toBe(false);
  });

  it('prefers the nearest ball on the player lane and points toward it', () => {
    const balls = [
      { id: 1, x: 300, tierIndex: 1 },
      { id: 2, x: 900, tierIndex: 2 },
      { id: 3, x: 760, tierIndex: 2 },
    ];
    expect(chooseKickfallFollowTarget({ playerX: 600, playerTierIndex: 2, balls }))
      .toEqual({ id: 3, laneDelta: 0, direction: 1 });
    expect(chooseKickfallFollowTarget({ playerX: 740, playerTierIndex: 2, balls }))
      .toEqual({ id: 3, laneDelta: 0, direction: 0 });
  });

  it('falls back to the closest lane, the lane above on a tie, and ignores unplaced balls', () => {
    const balls = [
      { id: 1, x: 600, tierIndex: 3 },
      { id: 2, x: 100, tierIndex: 1 },
      { id: 3, x: 600, tierIndex: -1 },
      { id: 4, x: Number.NaN, tierIndex: 2 },
    ];
    expect(chooseKickfallFollowTarget({ playerX: 600, playerTierIndex: 2, balls }))
      .toEqual({ id: 2, laneDelta: -1, direction: 0 });
    expect(chooseKickfallFollowTarget({ playerX: 600, playerTierIndex: 0, balls }))
      .toEqual({ id: 2, laneDelta: 1, direction: 0 });
    expect(chooseKickfallFollowTarget({ playerX: 600, playerTierIndex: 2, balls: [] })).toBeNull();
  });
});

describe('Kickfall level select (batch 3)', () => {
  it('lists all 20 levels with stars, locks unreached levels and marks the continue level', () => {
    const tiles = kickfallLevelTiles({
      highestUnlockedLevel: 4,
      lastPlayedLevel: 3,
      stars: { 1: 3, 2: 1, 3: 2, 9: 3 },
    });
    expect(tiles).toHaveLength(KICKFALL_MAX_LEVEL);
    expect(tiles.slice(0, 5)).toEqual([
      { level: 1, unlocked: true, stars: 3, current: false },
      { level: 2, unlocked: true, stars: 1, current: false },
      { level: 3, unlocked: true, stars: 2, current: true },
      { level: 4, unlocked: true, stars: 0, current: false },
      { level: 5, unlocked: false, stars: 0, current: false },
    ]);
    expect(tiles.filter((tile) => tile.unlocked)).toHaveLength(4);
  });

  it('survives corrupt saved progress and totals stars', () => {
    const tiles = kickfallLevelTiles({ highestUnlockedLevel: 'x', stars: { 1: 7, 2: -1, 3: 'two' } });
    expect(tiles[0].unlocked).toBe(true);
    expect(tiles.every((tile) => tile.stars >= 0 && tile.stars <= 3)).toBe(true);
    expect(kickfallLevelTiles(undefined)).toHaveLength(KICKFALL_MAX_LEVEL);
    expect(kickfallTotalStars({ highestUnlockedLevel: 5, stars: { 1: 3, 2: 2, 4: 1 } })).toBe(6);
  });
});
