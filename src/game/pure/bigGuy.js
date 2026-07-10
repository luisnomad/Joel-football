export const BIG_GUY_DURATION = 10;
export const BIG_GUY_TRANSITION = 0.4;
export const BIG_GUY_MAX_SCALE = 2;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothStep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export const createBigGuyState = () => ({
  secondsRemaining: 0,
  growElapsed: 0,
  scale: 1,
});

export const activateBigGuy = (state = createBigGuyState()) => ({
  secondsRemaining: BIG_GUY_DURATION,
  growElapsed: state.secondsRemaining > 0 ? BIG_GUY_TRANSITION : 0,
  scale: state.secondsRemaining > 0 ? state.scale : 1,
});

export const stepBigGuy = (state = createBigGuyState(), dt = 0) => {
  const delta = Math.max(0, Number(dt) || 0);
  const secondsRemaining = Math.max(0, state.secondsRemaining - delta);
  const growElapsed = Math.min(BIG_GUY_TRANSITION, state.growElapsed + delta);
  const growFactor = smoothStep(growElapsed / BIG_GUY_TRANSITION);
  const shrinkFactor = secondsRemaining < BIG_GUY_TRANSITION
    ? smoothStep(secondsRemaining / BIG_GUY_TRANSITION)
    : 1;
  const scale = 1 + (BIG_GUY_MAX_SCALE - 1) * Math.min(growFactor, shrinkFactor);

  return { secondsRemaining, growElapsed, scale };
};
