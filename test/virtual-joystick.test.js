import { describe, expect, it } from 'vitest';
import { resolveVirtualJoystickVector } from '../src/game/minigames/input/virtualJoystickMath.js';

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
});
