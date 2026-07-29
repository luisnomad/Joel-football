import { describe, expect, it, vi } from 'vitest';
import {
  CANCELABLE_GAME_TOUCH_EVENTS,
  NATIVE_GAME_GESTURE_EVENTS,
  installGameSurfaceInputGuard,
} from '../src/platform/gameSurfaceInput.js';

const createTarget = () => {
  const listeners = new Map();
  return {
    listeners,
    addEventListener: vi.fn((name, handler, options) => {
      listeners.set(name, { handler, options });
    }),
    removeEventListener: vi.fn((name) => {
      listeners.delete(name);
    }),
  };
};

describe('game surface native input guard', () => {
  it('cancels only cancelable touch and long-press browser defaults', () => {
    const target = createTarget();
    installGameSurfaceInputGuard(target);

    expect([...target.listeners.keys()]).toEqual([
      ...CANCELABLE_GAME_TOUCH_EVENTS,
      ...NATIVE_GAME_GESTURE_EVENTS,
    ]);
    CANCELABLE_GAME_TOUCH_EVENTS.forEach((eventName) => {
      expect(target.listeners.get(eventName).options).toEqual({ passive: false });
    });

    for (const { handler } of target.listeners.values()) {
      const cancelableEvent = {
        cancelable: true,
        preventDefault: vi.fn(),
      };
      handler(cancelableEvent);
      expect(cancelableEvent.preventDefault).toHaveBeenCalledOnce();

      const lifecycleEvent = {
        cancelable: false,
        preventDefault: vi.fn(),
      };
      handler(lifecycleEvent);
      expect(lifecycleEvent.preventDefault).not.toHaveBeenCalled();
    }
  });

  it('returns a cleanup function and safely accepts a missing target', () => {
    const target = createTarget();
    const cleanup = installGameSurfaceInputGuard(target);
    cleanup();
    expect(target.listeners.size).toBe(0);
    expect(() => installGameSurfaceInputGuard(null)()).not.toThrow();
  });
});
