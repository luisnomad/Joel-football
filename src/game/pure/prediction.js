import { GROUND_Y, BALL_RADIUS } from '../constants.js';
import { clamp } from './actions.js';

export const predictBallXAtHeight = (
  ball,
  targetY = GROUND_Y - (ball.radius ?? BALL_RADIUS),
  gravity = 0.58,
  maxSeconds = 2.2,
) => {
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  const dt = 1 / 30;

  for (let time = 0; time < maxSeconds && y < targetY; time += dt) {
    vy += gravity * dt * 60;
    x += vx * dt * 60;
    y += vy * dt * 60;
    const radius = ball.radius ?? BALL_RADIUS;
    if (x < radius || x > 1280 - radius) vx *= -0.78;
    x = clamp(x, radius, 1280 - radius);
  }

  return x;
};

export const isBallApproaching = (ball, side) =>
  side === 'right' ? ball.vx > 0 : ball.vx < 0;
