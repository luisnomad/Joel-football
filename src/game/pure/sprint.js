export const SPRINT_DOUBLE_TAP_MS = 280;
export const SPRINT_SPEED_MULTIPLIER = 1.5;
export const SPRINT_FORCE_MULTIPLIER = 1.4;

export const createDirectionTapState = () => ({
  lastDirection: 0,
  lastTapAt: Number.NEGATIVE_INFINITY,
  sprintDirection: 0,
});

export const registerDirectionTap = (state = createDirectionTapState(), { direction = 0, at = 0 } = {}) => {
  const safeDirection = Math.sign(Number(direction) || 0);
  const safeTime = Number.isFinite(at) ? at : 0;
  if (safeDirection === 0) return { ...state, sprintDirection: 0 };
  const elapsed = safeTime - state.lastTapAt;
  const sprintDirection = state.lastDirection === safeDirection
    && elapsed >= 0
    && elapsed <= SPRINT_DOUBLE_TAP_MS
    ? safeDirection
    : 0;
  return {
    lastDirection: safeDirection,
    lastTapAt: safeTime,
    sprintDirection,
  };
};
