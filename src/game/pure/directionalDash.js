export const DIRECTIONAL_DASH_DOUBLE_TAP_MS = 280;

export const createDirectionTapState = () => ({
  lastDirection: 0,
  lastTapAt: Number.NEGATIVE_INFINITY,
  dashDirection: 0,
});

export const registerDirectionTap = (state = createDirectionTapState(), { direction = 0, at = 0 } = {}) => {
  const safeDirection = Math.sign(Number(direction) || 0);
  const safeTime = Number.isFinite(at) ? at : 0;
  if (safeDirection === 0) return { ...state, dashDirection: 0 };
  const elapsed = safeTime - state.lastTapAt;
  const dashDirection = state.lastDirection === safeDirection
    && elapsed >= 0
    && elapsed <= DIRECTIONAL_DASH_DOUBLE_TAP_MS
    ? safeDirection
    : 0;
  return {
    lastDirection: safeDirection,
    lastTapAt: safeTime,
    dashDirection,
  };
};

export const resolveDirectionalDash = ({
  tapDirection = 0,
  attackDirection = 1,
  playerX = 0,
  opponentX = 0,
  ballX = 0,
} = {}) => {
  const direction = Math.sign(Number(tapDirection) || 0);
  if (!direction) return { direction: 0, purpose: 'none' };
  const attack = attackDirection >= 0 ? 1 : -1;
  const opponentDirection = Math.sign((Number(opponentX) || 0) - (Number(playerX) || 0)) || attack;
  const ballDirection = Math.sign((Number(ballX) || 0) - (Number(playerX) || 0));
  if (direction === opponentDirection) return { direction, purpose: 'challenge' };
  if (direction === attack) return { direction, purpose: ballDirection === attack ? 'attack-ball' : 'attack-space' };
  return { direction, purpose: ballDirection === -attack ? 'recover-ball' : 'defend-goal' };
};
