/**
 * Easy-only "follow the ball" assist (audit H3): picks the ball the player
 * should chase next and which way to go. Visual guidance only; it never moves
 * the player or the ball.
 */
export const KICKFALL_FOLLOW_ASSIST_DIFFICULTIES = Object.freeze(['easy']);

/** Horizontal distance (px) under which the ball counts as "at your feet". */
export const KICKFALL_FOLLOW_REACH_PX = 56;

export const isKickfallFollowAssistEnabled = (difficulty) => (
  KICKFALL_FOLLOW_ASSIST_DIFFICULTIES.includes(difficulty)
);

/**
 * Chooses the follow target from `balls` ({ id, x, tierIndex }).
 * Balls on the player's lane win (nearest first); otherwise the closest lane,
 * preferring the lane above on a tie because its balls roll down to the player.
 * Returns { id, laneDelta, direction } or null: `laneDelta` is target lane minus
 * player lane (+1 = one lane down), `direction` is -1/1 toward the ball on the
 * same lane, or 0 when it is within reach or on another lane.
 */
export const chooseKickfallFollowTarget = ({ playerX, playerTierIndex, balls = [] }) => {
  let best = null;
  let bestScore = Infinity;
  balls.forEach((ball) => {
    if (!Number.isFinite(ball?.x) || !Number.isInteger(ball?.tierIndex) || ball.tierIndex < 0) return;
    const laneDelta = ball.tierIndex - playerTierIndex;
    const laneScore = Math.abs(laneDelta) * 2 + (laneDelta > 0 ? 1 : 0);
    const score = laneScore * 10000 + Math.abs(ball.x - playerX);
    if (score < bestScore) {
      bestScore = score;
      best = { ball, laneDelta };
    }
  });
  if (!best) return null;
  const dx = best.ball.x - playerX;
  const direction = best.laneDelta === 0 && Math.abs(dx) > KICKFALL_FOLLOW_REACH_PX ? Math.sign(dx) : 0;
  return { id: best.ball.id, laneDelta: best.laneDelta, direction };
};
