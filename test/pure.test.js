import { describe, expect, it } from 'vitest';
import { applyAiDifficulty, normalizeIntent, safeDecide } from '../src/game/pure/actions.js';
import { POWER_ARM_SECONDS, armPower, chargeMeter, counterPowerVelocity } from '../src/game/pure/power.js';
import { addGoal, createScoreState, detectGoalCrossing, formatClock, tickMatchClock } from '../src/game/pure/rules.js';
import { createWorldSnapshot } from '../src/game/pure/snapshot.js';
import { decideHeuristicIntent } from '../src/game/ai/HeuristicAgentProvider.js';
import { predictBallXAtHeight } from '../src/game/pure/prediction.js';
import { createBufferedAsyncAgentProvider } from '../src/game/ai/BufferedAsyncAgentProvider.js';
import { resolveFacing } from '../src/game/pure/facing.js';
import { nextCountdownWhistle } from '../src/game/pure/countdownWhistle.js';
import {
  CHILENA_FIRE_COLOR,
  CHILENA_LOB_APEX_Y,
  canStartChilena,
  chilenaRotationAt,
  resolveChilenaShot,
  resolveLobChilenaLaunch,
  shouldRedirectLobChilena,
} from '../src/game/pure/chilena.js';
import { PLAYER_TUNING } from '../src/game/constants.js';
import {
  DIRECTIONAL_DASH_DOUBLE_TAP_MS,
  createDirectionTapState,
  registerDirectionTap,
  resolveDirectionalDash,
} from '../src/game/pure/directionalDash.js';
import {
  KICK_BOOST_MAX_TAPS,
  addKickBoostTaps,
  kickBoostMultipliers,
  resolveKickBoost,
} from '../src/game/pure/kickBoost.js';
import {
  CHARACTER_GROUND_ANCHOR_Y,
  CHARACTER_DISPLAY_HEIGHT,
  CHARACTER_DISPLAY_WIDTH,
  CHARACTER_GAMEPLAY_HEIGHT,
  CHARACTER_FRAMES,
  GROUNDED_VISUAL_FRAMES,
  RUN_FRAME_DISTANCE,
  RUN_VISUAL_SEQUENCE,
  isGroundedVisualFrame,
  kickVisualAt,
  runVisualAt,
} from '../src/game/pure/characterAnimation.js';
import {
  circleIntersectsCapsule,
  resolveAdaptiveLob,
  shouldResolvePlayerClash,
  sweepCircleAgainstBounds,
} from '../src/game/pure/gameplayPhysics.js';

describe('gameplay physics polish', () => {
  it('sweeps a fast ball through an expanded player body without tunneling', () => {
    const hit = sweepCircleAgainstBounds({
      previous: { x: 500, y: 500 },
      current: { x: 620, y: 500 },
      radius: 22,
      bounds: { min: { x: 550, y: 420 }, max: { x: 600, y: 570 } },
    });
    expect(hit).toMatchObject({ x: 528, y: 500, normal: { x: -1, y: 0 } });
    expect(hit.time).toBeCloseTo(28 / 120);
    expect(sweepCircleAgainstBounds({
      previous: { x: 500, y: 380 },
      current: { x: 620, y: 380 },
      radius: 22,
      bounds: { min: { x: 550, y: 420 }, max: { x: 600, y: 570 } },
    })).toBeNull();
  });

  it('aims close lobs higher and distant lobs farther while mirroring cleanly', () => {
    const close = resolveAdaptiveLob({ ballX: 600, ballY: 537, opponentX: 720, opponentY: 547, attackDirection: 1 });
    const far = resolveAdaptiveLob({ ballX: 600, ballY: 537, opponentX: 980, opponentY: 547, attackDirection: 1 });
    const mirrored = resolveAdaptiveLob({ ballX: 680, ballY: 537, opponentX: 560, opponentY: 547, attackDirection: -1 });
    expect(close.vy).toBeLessThan(far.vy);
    expect(far.vx).toBeGreaterThan(close.vx);
    expect(close.vy).toBeLessThanOrEqual(-18.8);
    expect(close.predictedApexY).toBeLessThan(far.predictedApexY - 100);
    expect(close.predictedClearance).toBeGreaterThan(140);
    expect(far.predictedClearance).toBeGreaterThan(35);
    expect(close.targetX).toBeGreaterThan(720);
    expect(mirrored.vx).toBeCloseTo(-close.vx);
    expect(mirrored.vy).toBeCloseTo(close.vy);
    expect(mirrored.predictedApexY).toBeCloseTo(close.predictedApexY);
  });

  it('caps point-blank lob height instead of becoming an unbounded vertical exploit', () => {
    const overlapping = resolveAdaptiveLob({ ballX: 600, ballY: 537, opponentX: 610, opponentY: 547 });
    const close = resolveAdaptiveLob({ ballX: 600, ballY: 537, opponentX: 710, opponentY: 547 });
    expect(overlapping.vy).toBe(close.vy);
    expect(overlapping.vx).toBe(close.vx);
    expect(overlapping.predictedApexY).toBeGreaterThan(210);
    expect(overlapping.targetX).toBeGreaterThanOrEqual(820);
  });

  it('recognizes a grounded inward stalemate but ignores ordinary passing movement', () => {
    const players = {
      left: { x: 590, vx: 0.4, grounded: true, stunned: false, kickTimer: 0 },
      right: { x: 680, vx: -0.3, grounded: true, stunned: false, kickTimer: 0 },
    };
    expect(shouldResolvePlayerClash({
      ...players,
      intents: { left: { move: 1 }, right: { move: -1 } },
    })).toBe(true);
    expect(shouldResolvePlayerClash({
      ...players,
      intents: { left: { move: 1 }, right: { move: 1 } },
    })).toBe(false);
    expect(shouldResolvePlayerClash({
      left: { ...players.left, grounded: false },
      right: players.right,
      intents: { left: { move: 1 }, right: { move: -1 } },
    })).toBe(false);
  });

  it('uses a front-foot capsule that includes the ball radius', () => {
    const strike = { start: { x: 608, y: 575 }, end: { x: 706, y: 575 }, capsuleRadius: 44 };
    expect(circleIntersectsCapsule({ circle: { x: 690, y: 637 }, radius: 22, ...strike })).toBe(true);
    expect(circleIntersectsCapsule({ circle: { x: 530, y: 575 }, radius: 22, ...strike })).toBe(false);
    expect(circleIntersectsCapsule({ circle: { x: 690, y: 650 }, radius: 22, ...strike })).toBe(false);
  });
});

describe('enhanced character animation', () => {
  it('defines one shared grounded foot anchor for every planted pose', () => {
    expect(CHARACTER_GROUND_ANCHOR_Y).toBe(418);
    expect(CHARACTER_DISPLAY_HEIGHT).toBe(280);
    expect(CHARACTER_DISPLAY_WIDTH / CHARACTER_DISPLAY_HEIGHT).toBeCloseTo(320 / 480);
    expect(CHARACTER_GAMEPLAY_HEIGHT).toBe(240);
    expect(GROUNDED_VISUAL_FRAMES).toEqual([0, 1, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(GROUNDED_VISUAL_FRAMES.every(isGroundedVisualFrame)).toBe(true);
    expect(isGroundedVisualFrame(2)).toBe(false);
    expect(isGroundedVisualFrame(3)).toBe(false);
  });

  it('uses a four-phase distance-driven run loop with two planted contacts', () => {
    expect(RUN_FRAME_DISTANCE).toBe(30);
    expect(RUN_VISUAL_SEQUENCE).toEqual([
      CHARACTER_FRAMES.runContactA,
      CHARACTER_FRAMES.runPassing,
      CHARACTER_FRAMES.runContactB,
      CHARACTER_FRAMES.runPassing,
    ]);
    expect([0, 1, 2, 3].map((phase) => runVisualAt(phase).stage)).toEqual([
      'contact-a',
      'passing-a',
      'contact-b',
      'passing-b',
    ]);
    expect([0, 1, 2, 3].filter((phase) => runVisualAt(phase).footstep)).toEqual([0, 2]);
  });

  it('stages the kick without changing its gameplay duration', () => {
    expect(kickVisualAt({ remaining: 0.16, duration: 0.16 })).toMatchObject({
      frame: CHARACTER_FRAMES.kickAnticipation,
      stage: 'anticipation',
    });
    expect(kickVisualAt({ remaining: 0.1, duration: 0.16 })).toMatchObject({
      frame: CHARACTER_FRAMES.kickContact,
      stage: 'contact',
    });
    expect(kickVisualAt({ remaining: 0.02, duration: 0.16 })).toMatchObject({
      frame: CHARACTER_FRAMES.kickRecovery,
      stage: 'recovery',
    });
  });
});

describe('movement tuning', () => {
  it('keeps the requested twenty-percent speed increase', () => {
    expect(PLAYER_TUNING.moveForce).toBeCloseTo(0.017 * 1.2);
    expect(PLAYER_TUNING.maxSpeed).toBeCloseTo(11.8 * 1.2);
  });
});

describe('directional double-tap dash contract', () => {
  it('requests one dash only after a same-direction second tap within 280 ms', () => {
    let state = createDirectionTapState();
    state = registerDirectionTap(state, { direction: 1, at: 100 });
    expect(state.dashDirection).toBe(0);
    state = registerDirectionTap(state, { direction: 1, at: 100 + DIRECTIONAL_DASH_DOUBLE_TAP_MS });
    expect(state.dashDirection).toBe(1);

    state = registerDirectionTap(createDirectionTapState(), { direction: -1, at: 100 });
    state = registerDirectionTap(state, { direction: 1, at: 200 });
    expect(state.dashDirection).toBe(0);

    state = registerDirectionTap(createDirectionTapState(), { direction: -1, at: 100 });
    state = registerDirectionTap(state, { direction: -1, at: 101 + DIRECTIONAL_DASH_DOUBLE_TAP_MS });
    expect(state.dashDirection).toBe(0);
  });

  it('keeps the chosen arrow direction and labels its useful match purpose', () => {
    expect(resolveDirectionalDash({
      tapDirection: 1,
      attackDirection: 1,
      playerX: 400,
      opponentX: 700,
      ballX: 760,
    })).toEqual({ direction: 1, purpose: 'challenge' });
    expect(resolveDirectionalDash({
      tapDirection: -1,
      attackDirection: 1,
      playerX: 400,
      opponentX: 700,
      ballX: 300,
    })).toEqual({ direction: -1, purpose: 'recover-ball' });
    expect(resolveDirectionalDash({
      tapDirection: 1,
      attackDirection: 1,
      playerX: 800,
      opponentX: 600,
      ballX: 700,
    })).toEqual({ direction: 1, purpose: 'attack-space' });
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
  it('scores only when the whole ball crosses the goal line inside the mouth', () => {
    expect(detectGoalCrossing({ previous: { x: 1160, y: 520 }, current: { x: 1195, y: 520 } })).toBe('left');
    expect(detectGoalCrossing({ previous: { x: 120, y: 520 }, current: { x: 80, y: 520 } })).toBe('right');
    expect(detectGoalCrossing({ previous: { x: 1160, y: 410 }, current: { x: 1195, y: 410 } })).toBeNull();
    expect(detectGoalCrossing({ previous: { x: 1160, y: 620 }, current: { x: 1195, y: 620 } })).toBeNull();
  });

  it('uses the selected object radius when checking the goal mouth', () => {
    expect(detectGoalCrossing({
      previous: { x: 1160, y: 520 },
      current: { x: 1200, y: 520 },
      radius: 27,
    })).toBe('left');
    expect(detectGoalCrossing({
      previous: { x: 1160, y: 420 },
      current: { x: 1200, y: 420 },
      radius: 27,
    })).toBeNull();
  });

  it('scores a ball rolling across either goal line at pitch level', () => {
    expect(detectGoalCrossing({ previous: { x: 1160, y: 614 }, current: { x: 1195, y: 614 } })).toBe('left');
    expect(detectGoalCrossing({ previous: { x: 120, y: 614.8 }, current: { x: 80, y: 614.8 } })).toBe('right');
  });

  it('does not turn an earlier over-goal crossing into a goal after the ball falls behind the line', () => {
    expect(detectGoalCrossing({ previous: { x: 1140, y: 400 }, current: { x: 1200, y: 410 } })).toBeNull();
    expect(detectGoalCrossing({ previous: { x: 1200, y: 410 }, current: { x: 1250, y: 520 } })).toBeNull();
  });

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
    const rightward = resolveChilenaShot({
      attackDirection: 1,
      ballX: 620,
      ballY: 360,
      targetX: 1178,
      targetY: 534,
    });
    const leftward = resolveChilenaShot({
      attackDirection: -1,
      ballX: 660,
      ballY: 360,
      targetX: 102,
      targetY: 534,
    });
    expect(rightward.vx).toBeGreaterThan(0);
    expect(rightward.vy).toBeGreaterThan(0);
    expect(leftward.vx).toBeCloseTo(-rightward.vx);
    expect(leftward.vy).toBeCloseTo(rightward.vy);
    expect(Math.hypot(rightward.vx, rightward.vy)).toBeCloseTo(27);
    expect(rightward).toMatchObject({ spin: 0.56, color: CHILENA_FIRE_COLOR, meterAfter: 100 });
  });

  it('aims low aerial balls up and high aerial balls down toward goal center', () => {
    const lowBall = resolveChilenaShot({ attackDirection: 1, ballX: 620, ballY: 580, targetX: 1178, targetY: 534 });
    const highBall = resolveChilenaShot({ attackDirection: 1, ballX: 620, ballY: 340, targetX: 1178, targetY: 534 });
    expect(lowBall.vy).toBeLessThan(0);
    expect(highBall.vy).toBeGreaterThan(0);
  });

  it('launches a lob chilena vertically, then redirects at its high apex', () => {
    const launch = resolveLobChilenaLaunch({
      attackDirection: 1,
      targetX: 1178,
      targetY: 534,
    });
    expect(launch.vx).toBeGreaterThan(0);
    expect(launch.vx).toBeLessThan(3);
    expect(launch.vy).toBeLessThan(-12);
    expect(CHILENA_LOB_APEX_Y).toBe(150);
    expect(launch.trajectory).toEqual({
      type: 'lob-chilena',
      phase: 'rising',
      apexY: CHILENA_LOB_APEX_Y,
      targetX: 1178,
      targetY: 534,
    });
    expect(shouldRedirectLobChilena({ ballY: 190, velocityY: -4 })).toBe(false);
    expect(shouldRedirectLobChilena({ ballY: CHILENA_LOB_APEX_Y, velocityY: -2 })).toBe(true);
    expect(shouldRedirectLobChilena({ ballY: 165, velocityY: 0.1 })).toBe(true);
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
      dashDirection: 0,
      power: false,
      kickBoost: 0,
    });
    expect(safeDecide({ decide: () => { throw new Error('offline'); } }, snapshot).move).toBe(0);
  });

  it('normalizes optional advanced intents and strips them from Easy AI', () => {
    const advanced = normalizeIntent({ move: -1, dash: true, dashDirection: -8, kickBoost: 8 });
    expect(advanced).toMatchObject({ dash: true, dashDirection: -1, kickBoost: 3 });
    expect(applyAiDifficulty(advanced, 'easy')).toMatchObject({ dash: false, dashDirection: 0, kickBoost: 0 });
    expect(applyAiDifficulty(advanced, 'normal')).toMatchObject({ dash: true, dashDirection: -1, kickBoost: 3 });
  });

  it('lets Normal and Hard AI request advanced mechanics while Easy plays without them', () => {
    const chase = createWorldSnapshot({
      score: createScoreState(),
      ball: { x: 720, y: 520, vx: 0, vy: 0 },
      left: { x: 300, y: 547, grounded: true, meter: 0, dashCooldown: 0 },
      right: { x: 1080, y: 547, grounded: true, meter: 24, dashCooldown: 0, kickTimer: 0.1 },
      powerBall: { active: false, owner: null },
    });
    expect(applyAiDifficulty(decideHeuristicIntent(chase, 'right', 'easy'), 'easy')).toMatchObject({ dashDirection: 0, kickBoost: 0 });
    expect(decideHeuristicIntent(chase, 'right', 'normal')).toMatchObject({ dash: true, dashDirection: -1, kickBoost: 1 });
    expect(decideHeuristicIntent(chase, 'right', 'hard')).toMatchObject({ dash: true, dashDirection: -1, kickBoost: 2 });
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

  it('falls back toward the projected landing point of a high lob', () => {
    const lobThreat = createWorldSnapshot({
      score: createScoreState(),
      ball: { x: 820, y: 270, vx: 7.3, vy: -4, radius: 22 },
      left: { x: 620, y: 547, grounded: true, meter: 0, dashCooldown: 0 },
      right: { x: 790, y: 547, grounded: true, meter: 20, dashCooldown: 1 },
      powerBall: { active: false, owner: null },
    });
    const intent = decideHeuristicIntent(lobThreat, 'right');
    expect(intent.move).toBe(1);
    expect(intent.jump).toBe(false);
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
