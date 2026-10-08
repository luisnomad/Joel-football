import { BALL_SHADOW_GRASS_INSET, ballShadowAt, ballShadowCenterY } from '../pure/ballShadow.js';

const TEXTURE = 'fx-ball-shadow';
const DEFAULT_RGB = '8, 24, 14';
const WIDTH = 128;
const HEIGHT = 40;

/**
 * Soft ellipse baked into a canvas texture, one per colour (the Canvas
 * renderer ignores tints). `rgb` is an "r, g, b" string.
 */
const ensureTexture = (scene, rgb = DEFAULT_RGB) => {
  const key = rgb === DEFAULT_RGB ? TEXTURE : `${TEXTURE}-${rgb.replace(/\D+/g, '-')}`;
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, WIDTH, HEIGHT);
  const context = canvas.getContext();
  context.save();
  context.translate(WIDTH / 2, HEIGHT / 2);
  context.scale(1, HEIGHT / WIDTH);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, WIDTH / 2);
  gradient.addColorStop(0, `rgba(${rgb}, 1)`);
  gradient.addColorStop(0.55, `rgba(${rgb}, 0.7)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, WIDTH / 2, 0, Math.PI * 2);
  context.fill();
  context.restore();
  canvas.refresh();
  return key;
};

/** Visual-only shadow on the pitch under the ball; never touches physics. */
export class BallShadow {
  /** `inset`: how far above the physics ground line the painted surface ends. */
  constructor(scene, {
    groundY = 0,
    depth = 12,
    inset = BALL_SHADOW_GRASS_INSET,
    rgb = DEFAULT_RGB,
  } = {}) {
    const texture = ensureTexture(scene, rgb);
    this.groundY = groundY;
    this.inset = inset;
    this.image = scene.add.image(0, groundY, texture).setDepth(depth).setOrigin(0.5, 0.5);
    this.state = null;
  }

  /** `groundY` overrides the constructor's surface (Kickfall: the tier under the ball). */
  update({ x, y, radius, groundY = this.groundY }) {
    const shadow = ballShadowAt({ ballY: y, groundY, radius });
    this.state = shadow;
    this.image
      .setPosition(x, ballShadowCenterY({ groundY, depth: shadow.depth, inset: this.inset }))
      .setDisplaySize(shadow.width, shadow.depth)
      .setAlpha(shadow.alpha)
      .setVisible(true);
  }

  debugState() {
    if (!this.state) return null;
    return {
      alpha: Math.round(this.state.alpha * 100) / 100,
      width: Math.round(this.state.width * 10) / 10,
      height: Math.round(this.state.height),
    };
  }

  destroy() {
    this.image.destroy();
  }
}
