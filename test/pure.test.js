import { describe, expect, it } from 'vitest';
import { normalizeIntent, safeDecide } from '../src/game/pure/actions.js';
import { POWER_ARM_SECONDS, armPower, chargeMeter, counterPowerVelocity } from '../src/game/pure/power.js';
import { addGoal, createScoreState, formatClock, tickMatchClock } from '../src/game/pure/rules.js';
import { createWorldSnapshot } from '../src/game/pure/snapshot.js';
import { decideHeuristicIntent } from '../src/game/ai/HeuristicAgentProvider.js';
import { predictBallXAtHeight } from '../src/game/pure/prediction.js';
import { createBufferedAsyncAgentProvider } from '../src/game/ai/BufferedAsyncAgentProvider.js';
import { resolveFacing } from '../src/game/pure/facing.js';
import { PLAYER_TUNING } from '../src/game/constants.js';

describe('movement tuning', () => {
  it('keeps the requested twenty-percent speed increase', () => {
    expect(PLAYER_TUNING.moveForce).toBeCloseTo(0.017 * 1.2);
    expect(PLAYER_TUNING.maxSpeed).toBeCloseTo(11.8 * 1.2);
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
    });
    expect(safeDecide({ decide: () => { throw new Error('offline'); } }, snapshot).move).toBe(0);
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
