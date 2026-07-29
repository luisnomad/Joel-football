import { describe, expect, it } from 'vitest';
import {
  resolveJoystickDashGesture,
  resolveVirtualJoystickVector,
} from '../src/game/input/virtualJoystickMath.js';

describe('virtual joystick vector', () => {
  it('stays neutral inside the configurable dead zone', () => {
    const state = resolveVirtualJoystickVector({
      dx: 12,
      dy: -8,
      radius: 80,
      deadZone: 0.25,
    });

    expect(state).toMatchObject({
      active: false,
      direction: 'neutral',
      left: false,
      right: false,
      up: false,
      down: false,
      thumbX: 12,
      thumbY: -8,
    });
    expect(state.force).toBeCloseTo(Math.hypot(12, 8) / 80);
  });

  it('resolves all four cardinal directions', () => {
    const resolve = (dx, dy) => resolveVirtualJoystickVector({ dx, dy, radius: 80 });

    expect(resolve(80, 0)).toMatchObject({ direction: 'right', right: true });
    expect(resolve(-80, 0)).toMatchObject({ direction: 'left', left: true });
    expect(resolve(0, -80)).toMatchObject({ direction: 'up', up: true });
    expect(resolve(0, 80)).toMatchObject({ direction: 'down', down: true });
  });

  it('resolves diagonals as two simultaneous digital directions', () => {
    expect(resolveVirtualJoystickVector({ dx: 70, dy: -70, radius: 80 })).toMatchObject({
      direction: 'up-right',
      right: true,
      up: true,
      left: false,
      down: false,
    });
    expect(resolveVirtualJoystickVector({ dx: -70, dy: 70, radius: 80 })).toMatchObject({
      direction: 'down-left',
      left: true,
      down: true,
      right: false,
      up: false,
    });
  });

  it('clamps the visual thumb and normalized vector to the outer radius', () => {
    const state = resolveVirtualJoystickVector({ dx: 120, dy: -160, radius: 80 });

    expect(state.force).toBe(1);
    expect(Math.hypot(state.thumbX, state.thumbY)).toBeCloseTo(80);
    expect(state.normalizedX).toBeCloseTo(0.6);
    expect(state.normalizedY).toBeCloseTo(-0.8);
  });

  it('locks a horizontal joystick to left/right even when the thumb drifts vertically', () => {
    const state = resolveVirtualJoystickVector({
      dx: -70,
      dy: -120,
      radius: 100,
      deadZone: 0.2,
      axis: 'horizontal',
    });

    expect(state).toMatchObject({
      axis: 'horizontal',
      direction: 'left',
      left: true,
      right: false,
      up: false,
      down: false,
      thumbY: 0,
      normalizedY: 0,
    });
  });

  it('marks only the configured outer ring as boosted', () => {
    const inner = resolveVirtualJoystickVector({
      dx: 70,
      radius: 100,
      axis: 'horizontal',
      boostThreshold: 0.82,
    });
    const outer = resolveVirtualJoystickVector({
      dx: 90,
      radius: 100,
      axis: 'horizontal',
      boostThreshold: 0.82,
    });

    expect(inner).toMatchObject({ force: 0.7, boosted: false });
    expect(outer).toMatchObject({ force: 0.9, boosted: true });
  });

  it('fires once at the edge and requires a return to neutral before rearming', () => {
    const firstEdge = resolveJoystickDashGesture({
      armed: true,
      active: true,
      boosted: true,
      move: 0.9,
    });
    const heldEdge = resolveJoystickDashGesture({
      armed: firstEdge.armed,
      active: true,
      boosted: true,
      move: 1,
    });
    const partialReturn = resolveJoystickDashGesture({
      armed: heldEdge.armed,
      active: true,
      boosted: false,
      move: 0.4,
    });
    const centered = resolveJoystickDashGesture({
      armed: partialReturn.armed,
      active: false,
      boosted: false,
      move: 0,
    });
    const secondEdge = resolveJoystickDashGesture({
      armed: centered.armed,
      active: true,
      boosted: true,
      move: 0.9,
    });

    expect(firstEdge).toEqual({ armed: false, triggeredDirection: 1 });
    expect(heldEdge).toEqual({ armed: false, triggeredDirection: 0 });
    expect(partialReturn).toEqual({ armed: false, triggeredDirection: 0 });
    expect(centered).toEqual({ armed: true, triggeredDirection: 0 });
    expect(secondEdge).toEqual({ armed: false, triggeredDirection: 1 });
  });
});
