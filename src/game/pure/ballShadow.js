/**
 * Ground shadow under the ball: it tells the player how high the ball is.
 * Full size and darkest when the ball touches the pitch, shrinking and fading
 * as it rises, so headers, jumps and chilenas are easier to judge.
 */

/** Height above the pitch (px) at which the shadow reaches its smallest, faintest state. */
export const BALL_SHADOW_FADE_HEIGHT = 380;
export const BALL_SHADOW_MAX_ALPHA = 0.78;
export const BALL_SHADOW_MIN_ALPHA = 0.32;
export const BALL_SHADOW_MIN_SCALE = 0.55;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * The painted grass ends about 14 px above the physics ground line (a white
 * edge stripe sits between them in the arena art), so the shadow's bottom edge
 * goes there; lower, it lands on the stripe and reads as a smudge.
 */
export const BALL_SHADOW_GRASS_INSET = 14;

/** Vertical centre of the shadow, with its bottom edge on the painted grass. */
export const ballShadowCenterY = ({ groundY, depth, inset = BALL_SHADOW_GRASS_INSET }) => (
  (Number(groundY) || 0) - inset - depth / 2
);

/**
 * Shadow geometry for a ball of `radius` centred at `ballY` over a pitch whose
 * surface is at `groundY` (all in world px). Width and height are the ellipse
 * size; `height` is the ball's clearance above the pitch.
 */
export const ballShadowAt = ({ ballY, groundY, radius = 22 } = {}) => {
  const height = Math.max(0, (Number(groundY) || 0) - ((Number(ballY) || 0) + radius));
  const t = clamp(height / BALL_SHADOW_FADE_HEIGHT, 0, 1);
  const scale = 1 - (1 - BALL_SHADOW_MIN_SCALE) * t;
  return {
    height,
    width: radius * 2.8 * scale,
    depth: radius * 0.8 * scale,
    alpha: BALL_SHADOW_MAX_ALPHA - (BALL_SHADOW_MAX_ALPHA - BALL_SHADOW_MIN_ALPHA) * t,
  };
};
