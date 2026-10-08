/**
 * Reactive goal net for the side-view football goal, independent of Phaser.
 *
 * The net is a small verlet cloth spanning the goal's side panel (the quad
 * between the front post, top bar, back post and ground bar). The top row,
 * bottom row and front column are pinned to the frame; interior points and the
 * back column are free, held by anchor springs and neighbour constraints, so
 * the back netting can bulge past the back post when a ball reaches it.
 *
 * During the goal celebration the ball is no longer frozen on the goal line:
 * `stepNetCapture` carries it into the goal, the net slows it, it drops and
 * settles. Scoring, timing and gameplay physics are unchanged.
 *
 * Units: world px, velocities in px per fixed tick (as Matter reports them),
 * `ticks` = elapsed fixed ticks (dt * 60). All buffers are preallocated: the
 * per-frame functions never allocate.
 */

export const GOAL_NET_COLUMNS = 7;
export const GOAL_NET_ROWS = 10;
/** Furthest the back netting may bulge past the back post (px). */
export const GOAL_NET_MAX_BULGE = 30;
/** World gravity per tick² (Matter gravity 1.08 at scale 0.001, 60 Hz). */
export const GOAL_NET_GRAVITY = 1.08 * 0.001 * (1000 / 60) ** 2;
const ANCHOR_STIFFNESS = 0.08;
const DAMPING = 0.9;
const CONSTRAINT_ITERATIONS = 2;
const SLEEP_SPEED = 0.02;

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * corners: { frontTop, frontBottom, backTop, backBottom } in world px.
 * outward: +1 when the back of the goal is to the right (right goal), -1 left.
 */
export const createGoalNet = ({
  corners,
  outward,
  columns = GOAL_NET_COLUMNS,
  rows = GOAL_NET_ROWS,
  maxBulge = GOAL_NET_MAX_BULGE,
}) => {
  const count = columns * rows;
  const net = {
    columns,
    rows,
    outward: outward >= 0 ? 1 : -1,
    maxBulge,
    corners,
    restX: new Float32Array(count),
    restY: new Float32Array(count),
    x: new Float32Array(count),
    y: new Float32Array(count),
    prevX: new Float32Array(count),
    prevY: new Float32Array(count),
    pinned: new Uint8Array(count),
    restSpacingX: 0,
    restSpacingY: 0,
    awake: false,
  };
  for (let row = 0; row < rows; row += 1) {
    const v = row / (rows - 1);
    const frontX = lerp(corners.frontTop.x, corners.frontBottom.x, v);
    const frontY = lerp(corners.frontTop.y, corners.frontBottom.y, v);
    const backX = lerp(corners.backTop.x, corners.backBottom.x, v);
    const backY = lerp(corners.backTop.y, corners.backBottom.y, v);
    for (let column = 0; column < columns; column += 1) {
      const u = column / (columns - 1);
      const index = row * columns + column;
      net.restX[index] = lerp(frontX, backX, u);
      net.restY[index] = lerp(frontY, backY, u);
      net.pinned[index] = row === 0 || row === rows - 1 || column === 0 ? 1 : 0;
    }
  }
  net.x.set(net.restX);
  net.y.set(net.restY);
  net.prevX.set(net.restX);
  net.prevY.set(net.restY);
  net.restSpacingX = Math.abs(net.restX[1] - net.restX[0]);
  net.restSpacingY = Math.abs(net.restY[columns] - net.restY[0]);
  return net;
};

/** Back-post x at a given world y (rest position of the back column). */
const backPostXAt = (net, y) => {
  const { backTop, backBottom } = net.corners;
  const v = Math.min(1, Math.max(0, (y - backTop.y) / Math.max(1, backBottom.y - backTop.y)));
  return lerp(backTop.x, backBottom.x, v);
};

const satisfyPair = (net, a, b, restLength) => {
  const dx = net.x[b] - net.x[a];
  const dy = net.y[b] - net.y[a];
  const length = Math.hypot(dx, dy) || 1;
  // Netting only resists stretching; slack is free.
  if (length <= restLength) return;
  const correction = (length - restLength) / length / 2;
  const pinnedA = net.pinned[a];
  const pinnedB = net.pinned[b];
  if (pinnedA && pinnedB) return;
  const shareA = pinnedA ? 0 : pinnedB ? 1 : 0.5;
  const shareB = pinnedB ? 0 : pinnedA ? 1 : 0.5;
  net.x[a] += dx * correction * 2 * shareA;
  net.y[a] += dy * correction * 2 * shareA;
  net.x[b] -= dx * correction * 2 * shareB;
  net.y[b] -= dy * correction * 2 * shareB;
};

/** Advance the cloth by `ticks` fixed ticks. Cheap no-op while asleep. */
export const stepGoalNet = (net, ticks = 1) => {
  if (!net.awake) return net;
  const { columns, rows } = net;
  let maxSpeed = 0;
  for (let index = 0; index < net.x.length; index += 1) {
    if (net.pinned[index]) continue;
    const vx = (net.x[index] - net.prevX[index]) * DAMPING;
    const vy = (net.y[index] - net.prevY[index]) * DAMPING;
    net.prevX[index] = net.x[index];
    net.prevY[index] = net.y[index];
    const ax = (net.restX[index] - net.x[index]) * ANCHOR_STIFFNESS;
    const ay = (net.restY[index] - net.y[index]) * ANCHOR_STIFFNESS;
    net.x[index] += vx + ax * ticks;
    net.y[index] += vy + ay * ticks;
    maxSpeed = Math.max(maxSpeed, Math.abs(vx) + Math.abs(vy));
  }
  const slackX = net.restSpacingX * 1.6;
  const slackY = net.restSpacingY * 1.6;
  for (let pass = 0; pass < CONSTRAINT_ITERATIONS; pass += 1) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        if (column + 1 < columns) satisfyPair(net, index, index + 1, slackX);
        if (row + 1 < rows) satisfyPair(net, index, index + columns, slackY);
      }
    }
  }
  // The back netting may bulge outward, but never further than maxBulge.
  for (let row = 1; row < rows - 1; row += 1) {
    const index = row * columns + columns - 1;
    const post = net.restX[index];
    const limit = post + net.outward * net.maxBulge;
    if (net.outward > 0) net.x[index] = Math.min(net.x[index], limit);
    else net.x[index] = Math.max(net.x[index], limit);
  }
  if (maxSpeed < SLEEP_SPEED) {
    let settled = true;
    for (let index = 0; index < net.x.length && settled; index += 1) {
      if (Math.abs(net.x[index] - net.restX[index]) + Math.abs(net.y[index] - net.restY[index]) > 0.25) settled = false;
    }
    if (settled) {
      net.x.set(net.restX);
      net.y.set(net.restY);
      net.prevX.set(net.restX);
      net.prevY.set(net.restY);
      net.awake = false;
    }
  }
  return net;
};

/**
 * A ball overlapping the net pushes the points it covers out to its surface
 * and drags them along with its motion, which bulges the netting.
 */
export const pushGoalNet = (net, { x, y, radius, vx = 0, vy = 0 }) => {
  const reach = radius * 1.25;
  let touched = false;
  for (let index = 0; index < net.x.length; index += 1) {
    if (net.pinned[index]) continue;
    const dx = net.x[index] - x;
    const dy = net.y[index] - y;
    const distance = Math.hypot(dx, dy);
    if (distance >= reach) continue;
    const scale = distance > 0.001 ? reach / distance : 0;
    net.x[index] = scale ? x + dx * scale : x + net.outward * reach;
    net.y[index] = scale ? y + dy * scale : y;
    // Leave some of the ball's motion in the point so the net keeps moving.
    net.prevX[index] = net.x[index] - vx * 0.6;
    net.prevY[index] = net.y[index] - vy * 0.6;
    touched = true;
  }
  if (touched) net.awake = true;
  return touched;
};

/** Ripple the netting near (x, y), e.g. a ball glancing off the roof. */
export const rippleGoalNet = (net, { x, y, strength = 4, radius = 60 }) => {
  for (let index = 0; index < net.x.length; index += 1) {
    if (net.pinned[index]) continue;
    const distance = Math.hypot(net.x[index] - x, net.y[index] - y);
    if (distance > radius) continue;
    const falloff = 1 - distance / radius;
    net.prevY[index] -= strength * falloff;
    net.prevX[index] -= net.outward * strength * 0.5 * falloff;
  }
  net.awake = true;
  return net;
};

/**
 * Bounds of the goal interior for a ball of `radius`: x between the goal line
 * and the back post (plus the bulge allowance), y between under the crossbar
 * and the ground.
 */
export const netCaptureBounds = (net, { radius, crossbarBottom, groundY, goalLineX }) => {
  const backAtGround = backPostXAt(net, groundY - radius);
  return {
    minY: crossbarBottom + radius,
    maxY: groundY - radius,
    goalLineX,
    backX: backAtGround + net.outward * (net.maxBulge * 0.8 - radius),
  };
};

/**
 * One fixed tick of the captured ball: gravity, net drag inside the goal, a
 * springy back net, a damped roof and a soft ground. Mutates and returns `ball`
 * ({ x, y, vx, vy, spin }). The ball never leaves the goal interior.
 */
export const stepNetCapture = (ball, bounds, net) => {
  const inward = -net.outward;
  ball.vy += GOAL_NET_GRAVITY;
  // Netting drag: stronger the deeper the ball is in the goal.
  const depth = Math.abs(ball.x - bounds.goalLineX);
  const span = Math.max(1, Math.abs(bounds.backX - bounds.goalLineX));
  const drag = 0.94 - 0.06 * Math.min(1, depth / span);
  ball.vx *= drag;
  ball.vy *= 0.985;
  ball.x += ball.vx;
  ball.y += ball.vy;
  // Back net: a spring that catches the ball and sends a little of it back.
  const beyond = (ball.x - bounds.backX) * net.outward;
  if (beyond > 0) {
    ball.x = bounds.backX;
    if (ball.vx * net.outward > 0) ball.vx = inward * Math.abs(ball.vx) * 0.25;
  }
  // Do not roll back out through the goal line.
  const outFront = (bounds.goalLineX - ball.x) * net.outward;
  if (outFront > 0) {
    ball.x = bounds.goalLineX;
    if (ball.vx * net.outward < 0) ball.vx = 0;
  }
  if (ball.y < bounds.minY) {
    ball.y = bounds.minY;
    if (ball.vy < 0) ball.vy = -ball.vy * 0.2;
  }
  if (ball.y > bounds.maxY) {
    ball.y = bounds.maxY;
    if (ball.vy > 0) ball.vy = -ball.vy * 0.3;
    if (Math.abs(ball.vy) < 0.6) ball.vy = 0;
    ball.vx *= 0.9;
  }
  ball.spin = (ball.spin ?? 0) * 0.95 + (ball.vx / 22) * 0.3;
  return ball;
};

export const isCapturedBallSettled = (ball, bounds) => (
  Math.abs(ball.vx) < 0.08 && Math.abs(ball.vy) < 0.08 && ball.y >= bounds.maxY - 0.5
);
