import { describe, expect, it } from 'vitest';
import {
  GOAL_NET_MAX_BULGE,
  createGoalNet,
  isCapturedBallSettled,
  netCaptureBounds,
  pushGoalNet,
  rippleGoalNet,
  stepGoalNet,
  stepNetCapture,
} from '../src/game/pure/goalNet.js';

// Right goal at the reference 1280x720 stage (goal-frame.svg panel mapped to world).
const rightCorners = {
  frontTop: { x: 1154, y: 414 },
  frontBottom: { x: 1154, y: 618 },
  backTop: { x: 1263, y: 404 },
  backBottom: { x: 1263, y: 624 },
};
const GOAL_LINE = 1154;
const makeNet = () => createGoalNet({ corners: rightCorners, outward: 1 });
const boundsFor = (net) => netCaptureBounds(net, { radius: 22, crossbarBottom: 411.5, groundY: 636, goalLineX: GOAL_LINE });

describe('goal net cloth', () => {
  it('pins the frame edges and starts at rest and asleep', () => {
    const net = makeNet();
    expect(net.awake).toBe(false);
    const { columns, rows } = net;
    expect(net.pinned[0]).toBe(1); // top row
    expect(net.pinned[(rows - 1) * columns + 3]).toBe(1); // bottom row
    expect(net.pinned[4 * columns]).toBe(1); // front column (front post)
    expect(net.pinned[4 * columns + columns - 1]).toBe(0); // back column can bulge
    expect(net.pinned[4 * columns + 3]).toBe(0); // interior
  });

  it('bulges where the ball pushes, never past the bulge limit, then settles and sleeps', () => {
    const net = makeNet();
    const touched = pushGoalNet(net, { x: 1262, y: 520, radius: 22, vx: 12, vy: 0 });
    expect(touched).toBe(true);
    expect(net.awake).toBe(true);
    const backIndex = 5 * net.columns + net.columns - 1;
    for (let tick = 0; tick < 3; tick += 1) {
      pushGoalNet(net, { x: 1275, y: 520, radius: 22, vx: 6, vy: 0 });
      stepGoalNet(net, 1);
    }
    for (let row = 1; row < net.rows - 1; row += 1) {
      const index = row * net.columns + net.columns - 1;
      expect(net.x[index]).toBeLessThanOrEqual(net.restX[index] + GOAL_NET_MAX_BULGE + 1e-3);
    }
    expect(net.x[backIndex]).toBeGreaterThan(net.restX[backIndex]);
    for (let tick = 0; tick < 600 && net.awake; tick += 1) stepGoalNet(net, 1);
    expect(net.awake).toBe(false);
    expect(Array.from(net.x)).toEqual(Array.from(net.restX));
  });

  it('ripples on a roof contact and calms down', () => {
    const net = makeNet();
    rippleGoalNet(net, { x: 1200, y: 430, strength: 5 });
    stepGoalNet(net, 1);
    const moved = Array.from(net.y).some((value, index) => Math.abs(value - net.restY[index]) > 0.5);
    expect(moved).toBe(true);
    for (let tick = 0; tick < 600 && net.awake; tick += 1) stepGoalNet(net, 1);
    expect(net.awake).toBe(false);
  });
});

describe('goal net ball capture', () => {
  // The goal phase lasts 1.65 s (99 fixed ticks); players resettle at 0.85 s.
  const GOAL_PHASE_TICKS = 99;

  it('carries every scored ball into the net and settles it on the ground inside the goal in time', () => {
    for (const vx of [4, 9, 16, 24, 30]) {
      for (const [y, vy] of [[600, 0], [520, -6], [470, 4], [430, 10]]) {
        const net = makeNet();
        const bounds = boundsFor(net);
        const ball = { x: GOAL_LINE + 2, y, vx, vy, spin: 0 };
        let settledAt = null;
        for (let tick = 0; tick < GOAL_PHASE_TICKS; tick += 1) {
          stepNetCapture(ball, bounds, net);
          pushGoalNet(net, { ...ball, radius: 22 });
          stepGoalNet(net, 1);
          expect(Number.isFinite(ball.x) && Number.isFinite(ball.y)).toBe(true);
          // Never leaves the goal interior.
          expect(ball.x).toBeGreaterThanOrEqual(GOAL_LINE);
          expect(ball.x).toBeLessThanOrEqual(bounds.backX + 1e-6);
          expect(ball.y).toBeGreaterThanOrEqual(bounds.minY);
          expect(ball.y).toBeLessThanOrEqual(bounds.maxY);
          if (settledAt === null && isCapturedBallSettled(ball, bounds)) settledAt = tick;
        }
        expect(settledAt, JSON.stringify({ vx, y, vy })).not.toBeNull();
        expect(ball.y).toBeCloseTo(bounds.maxY, 1);
      }
    }
  });

  it('keeps the left goal mirrored', () => {
    const corners = {
      frontTop: { x: 126, y: 414 },
      frontBottom: { x: 126, y: 618 },
      backTop: { x: 17, y: 404 },
      backBottom: { x: 17, y: 624 },
    };
    const net = createGoalNet({ corners, outward: -1 });
    const bounds = netCaptureBounds(net, { radius: 22, crossbarBottom: 411.5, groundY: 636, goalLineX: 126 });
    const ball = { x: 124, y: 560, vx: -20, vy: -2, spin: 0 };
    for (let tick = 0; tick < 99; tick += 1) stepNetCapture(ball, bounds, net);
    expect(ball.x).toBeLessThanOrEqual(126);
    expect(ball.x).toBeGreaterThanOrEqual(bounds.backX);
    expect(isCapturedBallSettled(ball, bounds)).toBe(true);
  });
});
