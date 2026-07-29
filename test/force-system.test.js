import { describe, expect, it } from 'vitest';
import {
  decayPressure,
  resolveDifficultyPressureTuning,
  resolveForceCombo,
  resolveForceDamage,
  resolveForceTransmission,
  resolvePressureImpact,
} from '../src/game/pure/forceSystem.js';

describe('shared force system', () => {
  it('transmits useful but diminishing force through a connected queue', () => {
    expect(resolveForceTransmission({ force: 1, retention: 0.84 })).toBeCloseTo(0.84);
    expect(resolveForceTransmission({ force: 1, retention: 0.84, hops: 3 }))
      .toBeCloseTo(0.84 ** 3);
    expect(resolveForceTransmission({
      force: 1,
      retention: 0.84,
      gap: 9,
      maximumGap: 8,
    })).toBe(0);
    expect(resolveForceTransmission({
      force: 0.13,
      retention: 0.84,
      minimumForce: 0.12,
    })).toBe(0);
  });

  it('rewards rapid repeated impacts without allowing an unlimited multiplier', () => {
    const first = resolveForceCombo({ contextId: 'upper:left', now: 10 });
    const second = resolveForceCombo({
      ...first,
      contextId: 'upper:left',
      previousContextId: first.contextId,
      previousAt: first.at,
      previousStage: first.stage,
      now: 10.5,
    });
    const third = resolveForceCombo({
      contextId: 'upper:left',
      previousContextId: second.contextId,
      previousAt: second.at,
      previousStage: second.stage,
      now: 10.9,
    });
    const fourth = resolveForceCombo({
      contextId: 'upper:left',
      previousContextId: third.contextId,
      previousAt: third.at,
      previousStage: third.stage,
      now: 11.2,
    });
    const reset = resolveForceCombo({
      contextId: 'lower:right',
      previousContextId: fourth.contextId,
      previousAt: fourth.at,
      previousStage: fourth.stage,
      now: 11.4,
    });

    expect([first.multiplier, second.multiplier, third.multiplier, fourth.multiplier])
      .toEqual([1, 1.25, 1.5, 1.5]);
    expect(reset).toMatchObject({ stage: 0, multiplier: 1 });
  });

  it('accumulates temporary pressure while preserving a reliable direct release', () => {
    const first = resolvePressureImpact({
      pressure: 0,
      incomingForce: 0.6,
      resistance: 1.1,
    });
    expect(first).toMatchObject({ released: false, pressure: 0.6 });

    const second = resolvePressureImpact({
      pressure: first.pressure,
      incomingForce: 0.55,
      resistance: 1.1,
    });
    expect(second.released).toBe(true);
    expect(second.pressureRatio).toBe(1);

    expect(resolvePressureImpact({
      pressure: 0,
      incomingForce: 0.2,
      resistance: 2,
      direct: true,
    }).released).toBe(true);
  });

  it('converts incoming force into capped permanent obstacle damage', () => {
    expect(resolveForceDamage({ incomingForce: 0.35, resistance: 0.7 }))
      .toBeCloseTo(0.5);
    expect(resolveForceDamage({ incomingForce: 2, resistance: 0.7, maximumDamage: 1 }))
      .toBe(1);
    expect(resolveForceDamage({ incomingForce: 0.08, resistance: 0.7, minimumForce: 0.12 }))
      .toBe(0);
  });

  it('scales resistance and decay by difficulty without changing transmission', () => {
    expect(resolveDifficultyPressureTuning({
      difficulty: 'easy',
      baseResistance: 1.5,
      baseDecayPerSecond: 0.8,
    })).toEqual({ resistance: 1.275, decayPerSecond: 0.6 });
    expect(resolveDifficultyPressureTuning({
      difficulty: 'hard',
      baseResistance: 1.5,
      baseDecayPerSecond: 0.8,
    })).toEqual({ resistance: 1.8, decayPerSecond: 1 });

    expect(decayPressure({
      pressure: 1,
      dt: 0.25,
      secondsSinceImpact: 0.4,
      graceSeconds: 0.5,
      decayPerSecond: 0.8,
    })).toBe(1);
    expect(decayPressure({
      pressure: 1,
      dt: 0.25,
      secondsSinceImpact: 0.75,
      graceSeconds: 0.5,
      decayPerSecond: 0.8,
    })).toBeCloseTo(0.8);
  });
});
