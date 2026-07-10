import { describe, expect, it } from 'vitest';
import { applyAiDifficulty, normalizeIntent, safeDecide } from '../src/game/pure/actions.js';
import { POWER_ARM_SECONDS, armPower, chargeMeter, counterPowerVelocity } from '../src/game/pure/power.js';
import { addGoal, createScoreState, formatClock, tickMatchClock } from '../src/game/pure/rules.js';
import { createWorldSnapshot } from '../src/game/pure/snapshot.js';
import { decideHeuristicIntent } from '../src/game/ai/HeuristicAgentProvider.js';
import { predictBallXAtHeight } from '../src/game/pure/prediction.js';
import { createBufferedAsyncAgentProvider } from '../src/game/ai/BufferedAsyncAgentProvider.js';
import { resolveFacing } from '../src/game/pure/facing.js';
import { nextCountdownWhistle } from '../src/game/pure/countdownWhistle.js';
import {
  CHILENA_FIRE_COLOR,
  canStartChilena,
  chilenaRotationAt,
  resolveChilenaShot,
} from '../src/game/pure/chilena.js';
import { PLAYER_TUNING } from '../src/game/constants.js';
import {
  SPRINT_DOUBLE_TAP_MS,
  SPRINT_SPEED_MULTIPLIER,
  createDirectionTapState,
  registerDirectionTap,
} from '../src/game/pure/sprint.js';
import {
  KICK_BOOST_MAX_TAPS,
  addKickBoostTaps,
  kickBoostMultipliers,
  resolveKickBoost,
} from '../src/game/pure/kickBoost.js';

describe('movement tuning', () => {
  it('keeps the requested twenty-percent speed increase', () => {
    expect(PLAYER_TUNING.moveForce).toBeCloseTo(0.017 * 1.2);
    expect(PLAYER_TUNING.maxSpeed).toBeCloseTo(11.8 * 1.2);
  });
});

describe('double-tap sprint contract', () => {
  it('starts only after a same-direction second tap within 280 ms', () => {
    let state = createDirectionTapState();
    state = registerDirectionTap(state, { direction: 1, at: 100 });
    expect(state.sprintDirection).toBe(0);
    state = registerDirectionTap(state, { direction: 1, at: 100 + SPRINT_DOUBLE_TAP_MS });
    expect(state.sprintDirection).toBe(1);

    state = registerDirectionTap(createDirectionTapState(), { direction: -1, at: 100 });
    state = registerDirectionTap(state, { direction: 1, at: 200 });
    expect(state.sprintDirection).toBe(0);

    state = registerDirectionTap(createDirectionTapState(), { direction: -1, at: 100 });
    state = registerDirectionTap(state, { direction: -1, at: 101 + SPRINT_DOUBLE_TAP_MS });
    expect(state.sprintDirection).toBe(0);
  });

  it('uses the requested exact 1.5× maximum-speed multiplier', () => {
    expect(SPRINT_SPEED_MULTIPLIER).toBe(1.5);
  });
});

describe('meter-backed mash kick contract', () => {
  it('caps repeated presses and spends energy proportionally only when resolved', () => {
    expect(addKickBoostTaps(1, 9)).toBe(KICK_BOOST_MAX_TAPS);
    expect(resolveKickBoost({ meter: 24, taps: 3, shotType: 'drive' })).toMatchObject({
      boosted: true,
      energySpent: 24,
      meterAfter: 0,
      speedMultiplier: 1.27,
    });
    expect(resolveKickBoost({ meter: 8, taps: 3, shotType: 'drive' })).toMatchObject({
      boosted: true,
      energySpent: 8,
      meterAfter: 0,
      speedMultiplier: 1.09,
    });
    expect(resolveKickBoost({ meter: 0, taps: 3, shotType: 'drive' }).boosted).toBe(false);
  });

  it('makes lobs higher but only slightly faster and stays below a full power shot', () => {
    const lob = resolveKickBoost({ meter: 24, taps: 3, shotType: 'lob' });
    expect(lob.speedMultiplier).toBe(1.16);
    expect(lob.liftMultiplier).toBe(1.27);
    expect(PLAYER_TUNING.kickSpeed * 1.27).toBeLessThan(PLAYER_TUNING.powerShotSpeed);
    expect(kickBoostMultipliers(0.5, 'drive')).toEqual({ speedMultiplier: 1.135, liftMultiplier: 1.05 });
  });
});

describe('player facing', () => {
  it('faces the rival goal while behind the defender, even when retreating', () => {
    expect(resolveFacing({
      attackDirection: 1,
      playerX: 400,
      opponentX: 800,
      movement: -1,
      currentFacing: -1,
    })).toBe(1);
    expect(resolveFacing({
      attackDirection: -1,
      playerX: 900,
      opponentX: 500,
      movement: 1,
      currentFacing: 1,
    })).toBe(-1);
  });

  it('allows movement to turn a player only after passing the defender', () => {
    expect(resolveFacing({
      attackDirection: 1,
      playerX: 900,
      opponentX: 700,
      movement: -1,
      currentFacing: 1,
    })).toBe(-1);
    expect(resolveFacing({
      attackDirection: -1,
      playerX: 300,
      opponentX: 600,
      movement: 1,
      currentFacing: -1,
    })).toBe(1);
  });
});

describe('power economy', () => {
  it('clamps charge and arms a full meter without wasting it before ball contact', () => {
    expect(chargeMeter(98, 8)).toBe(100);
    expect(armPower({ meter: 100, stunned: false, powerArmed: 0 })).toEqual({
      meter: 100,
      stunned: false,
      powerArmed: POWER_ARM_SECONDS,
    });
    expect(armPower({ meter: 99, stunned: false, powerArmed: 0 }).powerArmed).toBe(0);
  });

  it('scales charge rate without mutating the original value', () => {
    const starting = 10;
    expect(chargeMeter(starting, 5, 1.2)).toBe(16);
    expect(starting).toBe(10);
  });

  it('returns a bounded, reversed counter velocity', () => {
    expect(counterPowerVelocity({ incomingX: -30, incomingY: 3, facing: 1 })).toEqual({ x: 46, y: -2.95 });
    expect(counterPowerVelocity({ incomingX: 15, incomingY: 0, facing: -1 }).x).toBe(-30);
  });
});

describe('rules', () => {
  it('enters golden goal on a tied clock and ends on the next score', () => {
    const tied = tickMatchClock({ ...createScoreState(), secondsLeft: 0.1 }, 0.2);
    expect(tied.suddenDeath).toBe(true);
    expect(addGoal(tied, 'left').winner).toBe('left');
  });

  it('declares a regulation winner and formats the clock', () => {
    const leading = addGoal({ ...createScoreState(), secondsLeft: 0.1 }, 'right');
    expect(tickMatchClock(leading, 0.2).winner).toBe('right');
    expect(formatClock(62.1)).toBe('1:03');
    expect(formatClock(0, true)).toBe('GOLDEN GOAL');
  });

  it('increments score immutably', () => {
    const before = createScoreState();
    const after = addGoal(before, 'left');
    expect(after.left).toBe(1);
    expect(before.left).toBe(0);
  });
});

describe('countdown whistle contract', () => {
  it('uses a short-short-long cadence for 3–2–1', () => {
    expect(nextCountdownWhistle(0, 2.7)).toEqual({
      second: 3,
      shouldWhistle: true,
      style: 'short',
      cutoffMs: 180,
    });
    expect(nextCountdownWhistle(3, 1.99)).toEqual({
      second: 2,
      shouldWhistle: true,
      style: 'short',
      cutoffMs: 180,
    });
    expect(nextCountdownWhistle(2, 0.99)).toEqual({
      second: 1,
      shouldWhistle: true,
      style: 'long',
      cutoffMs: null,
    });
  });

  it('signals exactly once for each visible countdown second and never for GO', () => {
    let previousSecond = 0;
    const samples = [2.7, 2.4, 1.99, 1.2, 0.99, 0.4, 0];
    const whistles = samples.map((countdown) => {
      const signal = nextCountdownWhistle(previousSecond, countdown);
      previousSecond = signal.second;
      return signal.shouldWhistle;
    });
    expect(whistles).toEqual([true, false, true, false, true, false, false]);
  });

  it('starts a fresh round by signaling its first displayed second', () => {
    expect(nextCountdownWhistle(0, 2.4)).toMatchObject({ second: 3, shouldWhistle: true, style: 'short' });
    expect(nextCountdownWhistle(0, 1.9)).toMatchObject({ second: 2, shouldWhistle: true, style: 'short' });
  });
});

describe('chilena contract', () => {
  const fighter = { x: 600, y: 547, height: 240, grounded: true, stunned: false, active: false };

  it('requires two fast presses and an overhead ball within one player-height', () => {
    expect(canStartChilena({ fighter, ball: { x: 620, y: 360 }, kickPresses: 2 })).toBe(true);
    expect(canStartChilena({ fighter, ball: { x: 620, y: 360 }, kickPresses: 1 })).toBe(false);
    expect(canStartChilena({ fighter, ball: { x: 600, y: 300 }, kickPresses: 2 })).toBe(false);
    expect(canStartChilena({ fighter, ball: { x: 730, y: 420 }, kickPresses: 2 })).toBe(false);
  });

  it('cannot begin airborne, stunned, already active, or without an overhead ball', () => {
    expect(canStartChilena({ fighter: { ...fighter, grounded: false }, ball: { x: 600, y: 360 }, kickPresses: 2 })).toBe(false);
    expect(canStartChilena({ fighter: { ...fighter, stunned: true }, ball: { x: 600, y: 360 }, kickPresses: 2 })).toBe(false);
    expect(canStartChilena({ fighter: { ...fighter, active: true }, ball: { x: 600, y: 360 }, kickPresses: 2 })).toBe(false);
    expect(canStartChilena({ fighter, ball: { x: 600, y: 560 }, kickPresses: 2 })).toBe(false);
  });

  it('fires toward the rival goal and rewards a full meter', () => {
    expect(resolveChilenaShot({ attackDirection: 1 })).toEqual({
      vx: 27,
      vy: -6.4,
      spin: 0.56,
      color: CHILENA_FIRE_COLOR,
      meterAfter: 100,
    });
    expect(resolveChilenaShot({ attackDirection: -1 }).vx).toBe(-27);
  });

  it('rotates clockwise through one full turn during the kick pose', () => {
    expect(chilenaRotationAt(0)).toBe(0);
    expect(chilenaRotationAt(0.29)).toBe(180);
    expect(chilenaRotationAt(0.58)).toBe(360);
    expect(chilenaRotationAt(2)).toBe(360);
  });
});

describe('provider boundary', () => {
  const snapshot = createWorldSnapshot({
    score: createScoreState(),
    ball: { x: 1000, y: 520, vx: 5, vy: 0 },
    left: { x: 280, y: 560, grounded: true, meter: 0, dashCooldown: 0 },
    right: { x: 980, y: 560, grounded: true, meter: 100, dashCooldown: 0 },
    powerBall: { active: false, owner: null },
  });

  it('normalizes intents and fails provider exceptions safely', () => {
    expect(normalizeIntent({ move: 9, kick: 1 })).toEqual({
      move: 1,
      jump: false,
      kick: false,
      lob: false,
      dash: false,
      power: false,
      sprint: false,
      kickBoost: 0,
    });
    expect(safeDecide({ decide: () => { throw new Error('offline'); } }, snapshot).move).toBe(0);
  });

  it('normalizes optional advanced intents and strips them from Easy AI', () => {
    const advanced = normalizeIntent({ move: -1, sprint: true, kickBoost: 8 });
    expect(advanced).toMatchObject({ sprint: true, kickBoost: 3 });
    expect(applyAiDifficulty(advanced, 'easy')).toMatchObject({ sprint: false, kickBoost: 0 });
    expect(applyAiDifficulty(advanced, 'normal')).toMatchObject({ sprint: true, kickBoost: 3 });
  });

  it('lets Normal and Hard AI request advanced mechanics while Easy plays without them', () => {
    const chase = createWorldSnapshot({
      score: createScoreState(),
      ball: { x: 720, y: 520, vx: 0, vy: 0 },
      left: { x: 300, y: 547, grounded: true, meter: 0, dashCooldown: 0 },
      right: { x: 1080, y: 547, grounded: true, meter: 24, dashCooldown: 0, kickTimer: 0.1 },
      powerBall: { active: false, owner: null },
    });
    expect(decideHeuristicIntent(chase, 'right', 'easy')).toMatchObject({ sprint: false, kickBoost: 0 });
    expect(decideHeuristicIntent(chase, 'right', 'normal')).toMatchObject({ sprint: true, kickBoost: 1 });
    expect(decideHeuristicIntent(chase, 'right', 'hard')).toMatchObject({ sprint: true, kickBoost: 2 });
  });

  it('produces a useful defensive/attacking intent from immutable state', () => {
    const intent = decideHeuristicIntent(snapshot, 'right');
    expect(intent.move).toBeGreaterThanOrEqual(-1);
    expect(intent.move).toBeLessThanOrEqual(1);
    expect(intent.kick || intent.power).toBe(true);
    expect(Object.isFrozen(snapshot.players.right)).toBe(true);
  });

  it('tries to counter an incoming power ball at close range', () => {
    const powerThreat = createWorldSnapshot({
      score: createScoreState(),
      ball: { x: 930, y: 520, vx: 16, vy: 0 },
      left: { x: 350, y: 547, grounded: true, meter: 0, dashCooldown: 0 },
      right: { x: 990, y: 547, grounded: true, meter: 20, dashCooldown: 0 },
      powerBall: { active: true, owner: 'left' },
    });
    expect(decideHeuristicIntent(powerThreat, 'right').kick).toBe(true);
  });

  it('jumps for an approaching aerial threat', () => {
    const aerialThreat = createWorldSnapshot({
      score: createScoreState(),
      ball: { x: 930, y: 410, vx: 8, vy: 1 },
      left: { x: 350, y: 547, grounded: true, meter: 0, dashCooldown: 0 },
      right: { x: 990, y: 547, grounded: true, meter: 20, dashCooldown: 0 },
      powerBall: { active: false, owner: null },
    });
    expect(decideHeuristicIntent(aerialThreat, 'right').jump).toBe(true);
  });

  it('lobs over a nearby defender instead of driving into the block', () => {
    const blockedLane = createWorldSnapshot({
      score: createScoreState(),
      ball: { x: 665, y: 545, vx: 0, vy: 0 },
      left: { x: 600, y: 547, grounded: true, meter: 0, dashCooldown: 0 },
      right: { x: 700, y: 547, grounded: true, meter: 20, dashCooldown: 0 },
      powerBall: { active: false, owner: null },
    });
    const intent = decideHeuristicIntent(blockedLane, 'right');
    expect(intent.lob).toBe(true);
    expect(intent.kick).toBe(false);
  });
});

describe('prediction', () => {
  it('projects a moving ball toward its landing side without leaving the arena', () => {
    const result = predictBallXAtHeight({ x: 640, y: 260, vx: 4, vy: -1 });
    expect(result).toBeGreaterThan(640);
    expect(result).toBeLessThanOrEqual(1280 - 22);
  });
});

describe('buffered async provider', () => {
  it('keeps the frame synchronous and exposes the latest resolved LLM/network intent', async () => {
    const provider = createBufferedAsyncAgentProvider({
      decideAsync: async () => ({ move: 4, kick: true }),
      minIntervalMs: 1_000,
    });
    expect(provider.decide({ tick: 1 })).toMatchObject({ move: 0, kick: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(provider.decide({ tick: 2 })).toMatchObject({ move: 1, kick: true });
  });

  it('absorbs rejected async decisions and keeps the last safe intent', async () => {
    const provider = createBufferedAsyncAgentProvider({
      decideAsync: async () => { throw new Error('network offline'); },
      minIntervalMs: 1_000,
    });
    expect(provider.decide({ tick: 1 }).move).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(provider.decide({ tick: 2 }).move).toBe(0);
  });
});
