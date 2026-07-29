import { describe, expect, it } from 'vitest';
import {
  TOUCH_BUTTON_GUARD_MS,
  bindButtonInput,
  createButtonActivationGate,
} from '../src/game/ui/buttonInput.js';

const createTarget = (x, y) => {
  const handlers = new Map();
  return {
    x,
    y,
    on(event, handler) {
      const registered = handlers.get(event) ?? [];
      registered.push(handler);
      handlers.set(event, registered);
      return this;
    },
    emit(event, pointer = { id: 1, x, y }) {
      (handlers.get(event) ?? []).forEach((handler) => handler(pointer));
    },
  };
};

const createScene = () => ({
  game: {
    events: {
      emit() {},
    },
  },
});

describe('shared button activation gate', () => {
  it('suppresses a compatibility press at the same position until the guard expires', () => {
    const gate = createButtonActivationGate();
    const press = (now) => gate.tryActivate({
      now,
      x: 580,
      y: 430,
      guardMs: TOUCH_BUTTON_GUARD_MS,
    });

    expect(press(1_000)).toBe(true);
    expect(press(1_060)).toBe(false);
    expect(press(1_499)).toBe(false);
    expect(press(1_500)).toBe(true);
  });

  it('keeps different controls responsive during another control guard', () => {
    const gate = createButtonActivationGate();

    expect(gate.tryActivate({
      now: 1_000,
      x: 580,
      y: 430,
      guardMs: TOUCH_BUTTON_GUARD_MS,
    })).toBe(true);
    expect(gate.tryActivate({
      now: 1_060,
      x: 1_155,
      y: 430,
      guardMs: TOUCH_BUTTON_GUARD_MS,
    })).toBe(true);
  });

  it('tracks multiple recent control positions across a shared game gate', () => {
    const gate = createButtonActivationGate();
    const tryAt = (now, x) => gate.tryActivate({
      now,
      x,
      y: 430,
      guardMs: TOUCH_BUTTON_GUARD_MS,
    });

    expect(tryAt(1_000, 580)).toBe(true);
    expect(tryAt(1_060, 1_155)).toBe(true);
    expect(tryAt(1_120, 580)).toBe(false);
    expect(tryAt(1_120, 1_155)).toBe(false);
    expect(tryAt(1_560, 1_155)).toBe(true);
  });

  it('does not debounce desktop controls when no guard is requested', () => {
    const gate = createButtonActivationGate();
    const press = (now) => gate.tryActivate({ now, x: 200, y: 200, guardMs: 0 });

    expect(press(1_000)).toBe(true);
    expect(press(1_001)).toBe(true);
  });

  it('activates press-phase controls once and ignores their compatibility sequence', () => {
    const scene = createScene();
    const target = createTarget(580, 430);
    let activations = 0;
    bindButtonInput(scene, target, {
      activateOnPointerDown: true,
      guardMs: TOUCH_BUTTON_GUARD_MS,
      onActivate: () => { activations += 1; },
    });

    target.emit('pointerdown');
    expect(activations).toBe(1);
    target.emit('pointerup');
    expect(activations).toBe(1);
    target.emit('pointerdown');
    target.emit('pointerup');
    expect(activations).toBe(1);
  });

  it('activates release-phase controls once and ignores their compatibility sequence', () => {
    const scene = createScene();
    const target = createTarget(1_155, 430);
    let activations = 0;
    bindButtonInput(scene, target, {
      guardMs: TOUCH_BUTTON_GUARD_MS,
      onActivate: () => { activations += 1; },
    });

    target.emit('pointerdown');
    expect(activations).toBe(0);
    target.emit('pointerup');
    expect(activations).toBe(1);
    target.emit('pointerdown');
    target.emit('pointerup');
    expect(activations).toBe(1);
  });
});
