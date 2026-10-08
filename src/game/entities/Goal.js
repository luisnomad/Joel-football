import {
  CATEGORIES,
  CROSSBAR_HEIGHT,
  CROSSBAR_Y,
  GAME_WIDTH,
  GOAL_LINE_LEFT,
  GOAL_LINE_RIGHT,
  GROUND_Y,
} from '../constants.js';
import {
  createGoalNet,
  isCapturedBallSettled,
  netCaptureBounds,
  pushGoalNet,
  rippleGoalNet,
  stepGoalNet,
  stepNetCapture,
} from '../pure/goalNet.js';

/** goal-frame.svg viewBox and the net panel corners inside it. */
const SVG_WIDTH = 180;
const SVG_HEIGHT = 320;
const IMAGE_HEIGHT = 270;
const NET_PANEL = Object.freeze({
  backTop: { x: 21, y: 45 },
  frontTop: { x: 149, y: 57 },
  frontBottom: { x: 149, y: 299 },
  backBottom: { x: 21, y: 306 },
});
const NET_LINE_COLOR = 0xe9fbff;
const NET_SHADE_COLOR = 0xb9d9e2;
/** Frame shudder after a crossbar hit: px amplitude per px/tick of impact, decay. */
const SHUDDER_PER_SPEED = 0.18;
const SHUDDER_MAX = 4;
const SHUDDER_DECAY = 0.88;

export class Goal {
  constructor(scene, side) {
    this.scene = scene;
    this.side = side;
    const left = side === 'left';
    const goalLine = left ? GOAL_LINE_LEFT : GOAL_LINE_RIGHT;
    this.goalLine = goalLine;
    const horizontalOffset = Math.max(0, (scene.stageLayout?.width ?? GAME_WIDTH) - GAME_WIDTH) / 2;
    const imageWidth = 150 + horizontalOffset;
    const imageX = left
      ? 75 - horizontalOffset / 2
      : GAME_WIDTH - 75 + horizontalOffset / 2;
    this.imageX = imageX;
    this.image = scene.add.image(imageX, GROUND_Y, 'goal-frame')
      .setDisplaySize(imageWidth, IMAGE_HEIGHT)
      .setOrigin(0.5, 1)
      .setFlipX(!left)
      .setDepth(10);

    const baseCrossbarWidth = left ? goalLine + 6 : GAME_WIDTH - goalLine + 6;
    const crossbarWidth = baseCrossbarWidth + horizontalOffset;
    const crossbarX = left
      ? (baseCrossbarWidth - horizontalOffset) / 2
      : GAME_WIDTH - baseCrossbarWidth / 2 + horizontalOffset / 2;
    this.crossbar = scene.matter.add.rectangle(crossbarX, CROSSBAR_Y, crossbarWidth, CROSSBAR_HEIGHT, {
      isStatic: true,
      label: `${side}-crossbar`,
      restitution: 0.88,
      friction: 0.02,
      collisionFilter: {
        category: CATEGORIES.GOAL,
        mask: CATEGORIES.BALL | CATEGORIES.PLAYER,
      },
    });

    // SVG panel corner -> world point (the image may be stretched on wide stages).
    const toWorld = ({ x, y }) => {
      const offsetX = (x / SVG_WIDTH) * imageWidth;
      return {
        x: left ? imageX - imageWidth / 2 + offsetX : imageX + imageWidth / 2 - offsetX,
        y: GROUND_Y - IMAGE_HEIGHT + (y / SVG_HEIGHT) * IMAGE_HEIGHT,
      };
    };
    this.net = createGoalNet({
      corners: {
        frontTop: toWorld(NET_PANEL.frontTop),
        frontBottom: toWorld(NET_PANEL.frontBottom),
        backTop: toWorld(NET_PANEL.backTop),
        backBottom: toWorld(NET_PANEL.backBottom),
      },
      outward: left ? -1 : 1,
    });
    this.netGraphics = scene.add.graphics().setDepth(9);
    this.shudder = 0;
    this.shudderPhase = 0;
    this.captured = null;
    this.drawNet();
  }

  /** Start carrying a scored ball into the net (velocity in px/tick). */
  startCapture({ x, y, vx, vy, radius }) {
    this.captured = { x, y, vx, vy, spin: 0, radius, settled: false };
    this.captureBounds = netCaptureBounds(this.net, {
      radius,
      crossbarBottom: CROSSBAR_Y + CROSSBAR_HEIGHT / 2,
      groundY: GROUND_Y,
      goalLineX: this.goalLine,
    });
    this.net.awake = true;
  }

  endCapture() {
    this.captured = null;
  }

  /** A ball hit the crossbar: ripple the roof netting and shudder the frame. */
  onCrossbarHit({ x, y, speed }) {
    this.shudder = Math.min(SHUDDER_MAX, Math.max(this.shudder, speed * SHUDDER_PER_SPEED));
    this.shudderPhase = 0;
    rippleGoalNet(this.net, { x, y: y + 20, strength: Math.min(6, 1 + speed * 0.3) });
  }

  /**
   * Fixed-step update. Returns the captured ball's new position (or null) so
   * MatchScene can place the frozen ball body there.
   */
  update(dt) {
    const ticks = dt * 60;
    let ball = null;
    if (this.captured && !this.captured.settled) {
      stepNetCapture(this.captured, this.captureBounds, this.net);
      pushGoalNet(this.net, this.captured);
      this.captured.settled = isCapturedBallSettled(this.captured, this.captureBounds);
    }
    if (this.captured) ball = this.captured;
    stepGoalNet(this.net, ticks);
    if (this.shudder > 0.05) {
      this.shudderPhase += ticks * 1.4;
      this.shudder *= SHUDDER_DECAY ** ticks;
    } else {
      this.shudder = 0;
    }
    const offsetX = Math.sin(this.shudderPhase) * this.shudder;
    this.image.setX(this.imageX + offsetX);
    this.netGraphics.setX(offsetX);
    if (this.net.awake || this.lastDrawnAwake) this.drawNet();
    this.lastDrawnAwake = this.net.awake;
    return ball;
  }

  /** Diamond mesh like the painted net, drawn from the cloth points. */
  drawNet() {
    const { x, y, columns, rows } = this.net;
    const graphics = this.netGraphics;
    graphics.clear();
    // Faint panel fill following the (possibly bulging) outline.
    graphics.fillStyle(0xbdebf2, 0.1).beginPath();
    graphics.moveTo(x[0], y[0]);
    for (let column = 1; column < columns; column += 1) graphics.lineTo(x[column], y[column]);
    for (let row = 1; row < rows; row += 1) graphics.lineTo(x[row * columns + columns - 1], y[row * columns + columns - 1]);
    for (let column = columns - 2; column >= 0; column -= 1) graphics.lineTo(x[(rows - 1) * columns + column], y[(rows - 1) * columns + column]);
    for (let row = rows - 2; row > 0; row -= 1) graphics.lineTo(x[row * columns], y[row * columns]);
    graphics.closePath().fillPath();
    // Two diagonal strand families make the diamond netting.
    graphics.lineStyle(2, NET_LINE_COLOR, 0.78);
    for (let row = 0; row < rows - 1; row += 1) {
      for (let column = 0; column < columns - 1; column += 1) {
        const a = row * columns + column;
        graphics.lineBetween(x[a], y[a], x[a + columns + 1], y[a + columns + 1]);
      }
    }
    graphics.lineStyle(1.4, NET_SHADE_COLOR, 0.6);
    for (let row = 0; row < rows - 1; row += 1) {
      for (let column = 1; column < columns; column += 1) {
        const a = row * columns + column;
        graphics.lineBetween(x[a], y[a], x[a + columns - 1], y[a + columns - 1]);
      }
    }
  }

  debugState() {
    return {
      awake: this.net.awake,
      captured: Boolean(this.captured),
      settled: Boolean(this.captured?.settled),
      shudder: Math.round(this.shudder * 100) / 100,
      ball: this.captured ? { x: Math.round(this.captured.x * 10) / 10, y: Math.round(this.captured.y * 10) / 10 } : null,
      backX: this.captureBounds ? Math.round(this.captureBounds.backX * 10) / 10 : null,
    };
  }
}
