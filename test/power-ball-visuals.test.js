import { describe, expect, it } from 'vitest';
import {
  POWER_BALL_CALM_SPEED,
  POWER_BALL_FADE_SECONDS,
  POWER_BALL_FULL_SPEED,
  getPowerBallStyle,
  mixColor,
  powerBallIntensity,
  stepPowerBallFade,
  trailSegmentAt,
} from '../src/game/pure/powerBallVisuals.js';

describe('power ball visuals', () => {
  it('gives each shot type its own identity instead of one tinted sticker', () => {
    expect(getPowerBallStyle({ superpowerId: null, owner: 'left' }).kind).toBe('energy');
    expect(getPowerBallStyle({ superpowerId: 'fireball' }).kind).toBe('fire');
    expect(getPowerBallStyle({ superpowerId: 'chilena' }).kind).toBe('fire');
    expect(getPowerBallStyle({ superpowerId: 'chilena-lob' }).kind).toBe('fire');
    expect(getPowerBallStyle({ superpowerId: 'big' }).kind).toBe('gold');
    expect(getPowerBallStyle({ superpowerId: 'fireball' }).smoke).toBe(true);
    expect(getPowerBallStyle({ superpowerId: 'big' }).smoke).toBe(false);
    // The standard power shot keeps the owner's side colours.
    const left = getPowerBallStyle({ owner: 'left' });
    const right = getPowerBallStyle({ owner: 'right' });
    expect(left.glow).not.toBe(right.glow);
    expect(getPowerBallStyle({ owner: 'left', color: 0x123456 }).glow).toBe(0x123456);
  });

  it('calms the effect on a slow or stopped ball and scales it with speed', () => {
    expect(powerBallIntensity({ speed: 0 })).toBe(0);
    expect(powerBallIntensity({ speed: POWER_BALL_CALM_SPEED })).toBe(0);
    expect(powerBallIntensity({ speed: POWER_BALL_FULL_SPEED })).toBe(1);
    expect(powerBallIntensity({ speed: 40 })).toBe(1);
    expect(powerBallIntensity({ speed: (POWER_BALL_CALM_SPEED + POWER_BALL_FULL_SPEED) / 2 })).toBeCloseTo(0.5);
    expect(powerBallIntensity({ speed: 40, fade: 0.25 })).toBeCloseTo(0.25);
  });

  it('fades in while the power is active and out after it ends instead of popping', () => {
    const half = POWER_BALL_FADE_SECONDS / 2;
    expect(stepPowerBallFade({ fade: 0, active: true, dt: half })).toBeCloseTo(0.5);
    expect(stepPowerBallFade({ fade: 1, active: true, dt: 1 })).toBe(1);
    expect(stepPowerBallFade({ fade: 1, active: false, dt: half })).toBeCloseTo(0.5);
    expect(stepPowerBallFade({ fade: 0.1, active: false, dt: 1 })).toBe(0);
  });

  it('tapers the streak from the ball to its tail', () => {
    const head = trailSegmentAt(0, 12, { trailWidth: 40, intensity: 1 });
    const middle = trailSegmentAt(6, 12, { trailWidth: 40, intensity: 1 });
    const tail = trailSegmentAt(11, 12, { trailWidth: 40, intensity: 1 });
    expect(head.width).toBeCloseTo(40);
    expect(middle.width).toBeLessThan(head.width);
    expect(tail.width).toBeLessThan(middle.width);
    expect(tail.alpha).toBe(0);
    expect(trailSegmentAt(0, 12, { trailWidth: 40, intensity: 0 }).alpha).toBe(0);
  });

  it('mixes colours channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0xff0000, 0x0000ff, 0.5)).toBe(0x800080);
  });
});
