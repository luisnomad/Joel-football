export const CANCELABLE_GAME_TOUCH_EVENTS = Object.freeze(['touchstart', 'touchmove']);
export const NATIVE_GAME_GESTURE_EVENTS = Object.freeze([
  'contextmenu',
  'dragstart',
  'selectstart',
]);

const preventCancelableDefault = (event) => {
  if (event?.cancelable) event.preventDefault?.();
};

export const installGameSurfaceInputGuard = (target) => {
  if (!target?.addEventListener) return () => {};

  const touchOptions = { passive: false };
  CANCELABLE_GAME_TOUCH_EVENTS.forEach((eventName) => {
    target.addEventListener(eventName, preventCancelableDefault, touchOptions);
  });
  NATIVE_GAME_GESTURE_EVENTS.forEach((eventName) => {
    target.addEventListener(eventName, preventCancelableDefault);
  });

  return () => {
    CANCELABLE_GAME_TOUCH_EVENTS.forEach((eventName) => {
      target.removeEventListener?.(eventName, preventCancelableDefault, touchOptions);
    });
    NATIVE_GAME_GESTURE_EVENTS.forEach((eventName) => {
      target.removeEventListener?.(eventName, preventCancelableDefault);
    });
  };
};
