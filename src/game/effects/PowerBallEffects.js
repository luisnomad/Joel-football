import Phaser from 'phaser';
import {
  POWER_BALL_TRAIL_POINTS,
  getPowerBallStyle,
  mixColor,
  powerBallIntensity,
  stepPowerBallFade,
  trailSegmentAt,
} from '../pure/powerBallVisuals.js';

const SOFT_TEXTURE = 'fx-soft';
const SPARK_TEXTURE = 'fx-spark';
const SOFT_SIZE = 64;
const SPARK_SIZE = 24;
/** Upper bound on live particles (tablet budget). */
const MAX_PARTICLES = 140;

const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Runtime textures, one per colour: a soft radial glow and a four-point spark.
 * The game renders with Phaser's Canvas renderer (src/main.js), which ignores
 * setTint, so colour has to be baked into the texture.
 */
const softTexture = (scene, color) => {
  const key = `${SOFT_TEXTURE}-${color.toString(16)}`;
  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, SOFT_SIZE, SOFT_SIZE);
    const context = canvas.getContext();
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, hex(color));
    gradient.addColorStop(0.35, `${hex(color)}b3`);
    gradient.addColorStop(1, `${hex(color)}00`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, SOFT_SIZE, SOFT_SIZE);
    canvas.refresh();
  }
  return key;
};

const sparkTexture = (scene, color) => {
  const key = `${SPARK_TEXTURE}-${color.toString(16)}`;
  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, SPARK_SIZE, SPARK_SIZE);
    const context = canvas.getContext();
    context.fillStyle = hex(color);
    context.beginPath();
    context.moveTo(12, 0);
    context.quadraticCurveTo(13.5, 10.5, 24, 12);
    context.quadraticCurveTo(13.5, 13.5, 12, 24);
    context.quadraticCurveTo(10.5, 13.5, 0, 12);
    context.quadraticCurveTo(10.5, 10.5, 12, 0);
    context.fill();
    canvas.refresh();
  }
  return key;
};

/** Palette stage for t in 0..1 (stepwise: textures are pre-coloured). */
const paletteIndexAt = (count, t) => Math.min(count - 1, Math.floor(Math.max(0, t) * count));

/**
 * Glow, tapered streak and per-type particles for the empowered ball. Replaces
 * the single tinted comet sticker. Visual only: never touches the ball body.
 * Particles are a small pooled system stepped by update(dt), so they follow the
 * game's own clock (and deterministic test stepping) like everything else.
 */
export class PowerBallEffects {
  constructor(scene, { depth = 19 } = {}) {
    this.scene = scene;
    this.depth = depth;
    this.fade = 0;
    this.style = null;
    this.trail = [];
    this.emitAccumulator = 0;
    this.sparkAccumulator = 0;
    this.smokeAccumulator = 0;
    this.clock = 0;
    this.particles = [];
    this.pool = [];
    // Coloured layers blend normally so they keep their hue on the bright pitch
    // (additive blending turns everything lime/white over green); only the small
    // hot core and the sparks are additive.
    this.trailGraphics = scene.add.graphics().setDepth(depth - 5);
    this.glow = scene.add.image(0, 0, softTexture(scene, 0xffffff)).setDepth(depth).setVisible(false);
    this.core = scene.add.image(0, 0, softTexture(scene, 0xffffff))
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
  }

  spawn({ x, y, shape, vx, vy, life, scaleStart, scaleEnd, alpha, colors, gravity, additive, spin = 0, depth }) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const make = shape === 'spark' ? sparkTexture : softTexture;
    const textures = colors.map((color) => make(this.scene, color));
    const image = this.pool.pop() ?? this.scene.add.image(0, 0, textures[0]);
    image
      .setTexture(textures[0])
      .setBlendMode(additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setDepth(depth)
      .setVisible(true)
      .setPosition(x, y)
      .setAngle(Math.random() * 360);
    this.particles.push({ image, x, y, vx, vy, age: 0, life, scaleStart, scaleEnd, alpha, textures, stage: 0, gravity, spin });
  }

  stepParticles(dt) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += dt;
      const t = particle.age / particle.life;
      if (t >= 1) {
        particle.image.setVisible(false);
        this.pool.push(particle.image);
        this.particles.splice(index, 1);
        continue;
      }
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      const stage = paletteIndexAt(particle.textures.length, t);
      if (stage !== particle.stage) {
        particle.stage = stage;
        particle.image.setTexture(particle.textures[stage]);
      }
      particle.image
        .setPosition(particle.x, particle.y)
        .setScale(particle.scaleStart + (particle.scaleEnd - particle.scaleStart) * t)
        .setAlpha(particle.alpha * (1 - t ** 1.6))
        .setAngle(particle.image.angle + particle.spin * dt);
    }
  }

  emit(style, ballX, ballY, intensity, dt) {
    const random = (min, max) => min + Math.random() * (max - min);
    const direction = () => random(0, Math.PI * 2);
    this.emitAccumulator += style.emitPerSecond * intensity * dt;
    this.sparkAccumulator += style.sparksPerSecond * intensity * dt;
    this.smokeAccumulator += (style.smoke ? 22 : 0) * intensity * dt;
    for (; this.emitAccumulator >= 1; this.emitAccumulator -= 1) {
      const angle = direction();
      const speed = random(8, 40);
      this.spawn({
        x: ballX + random(-8, 8),
        y: ballY + random(-8, 8),
        shape: 'soft',
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: style.particleLife * random(0.7, 1.2),
        scaleStart: style.particleScale,
        scaleEnd: 0.08,
        alpha: 1,
        colors: style.particles,
        gravity: -style.rise * 2,
        additive: false,
        depth: this.depth - 2,
      });
    }
    for (; this.sparkAccumulator >= 1; this.sparkAccumulator -= 1) {
      const angle = direction();
      const speed = random(60, 170);
      this.spawn({
        x: ballX,
        y: ballY,
        shape: 'spark',
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(0.25, 0.5),
        scaleStart: style.kind === 'gold' ? 0.7 : 0.45,
        scaleEnd: 0,
        alpha: 1,
        colors: [style.particles[0], style.particles[1]],
        gravity: style.kind === 'fire' ? -60 : 140,
        additive: true,
        spin: style.kind === 'gold' ? 360 : 0,
        depth: this.depth - 1,
      });
    }
    for (; this.smokeAccumulator >= 1; this.smokeAccumulator -= 1) {
      const angle = direction();
      this.spawn({
        x: ballX + random(-10, 10),
        y: ballY + random(-10, 10),
        shape: 'soft',
        vx: Math.cos(angle) * 12,
        vy: Math.sin(angle) * 12,
        life: random(0.45, 0.7),
        scaleStart: 0.3,
        scaleEnd: 0.85,
        alpha: 0.2,
        colors: [0x6a5a52, 0x3a3330],
        gravity: -70,
        additive: false,
        depth: this.depth - 3,
      });
    }
  }

  /**
   * Call once per rendered frame with the frame's dt (seconds). `powerBall` is
   * MatchScene's power state; `velocity` the ball's Matter velocity (px/tick).
   */
  update(dt, { powerBall, ballX, ballY, velocity }) {
    const step = Math.max(0, Number(dt) || 0);
    this.clock += step;
    this.stepParticles(step);
    if (powerBall?.active) {
      this.style = getPowerBallStyle({
        superpowerId: powerBall.superpowerId,
        owner: powerBall.owner,
        color: powerBall.color,
      });
    }
    this.fade = stepPowerBallFade({ fade: this.fade, active: Boolean(powerBall?.active), dt: step });
    const style = this.style;
    if (!style || this.fade <= 0) {
      this.clearStreak();
      return;
    }
    const speed = Math.hypot(velocity.x, velocity.y);
    const intensity = powerBallIntensity({ speed, fade: this.fade });

    // Tapered streak along the ball's real path.
    this.trail.unshift({ x: ballX, y: ballY });
    this.trail.length = Math.min(this.trail.length, POWER_BALL_TRAIL_POINTS);
    this.trailGraphics.clear();
    for (let index = this.trail.length - 1; index > 0; index -= 1) {
      const from = this.trail[index];
      const to = this.trail[index - 1];
      const segment = trailSegmentAt(index, this.trail.length, { trailWidth: style.trailWidth, intensity });
      const color = mixColor(style.trailHead, style.trailTail, index / this.trail.length);
      this.trailGraphics.lineStyle(segment.width, color, segment.alpha).lineBetween(from.x, from.y, to.x, to.y);
      this.trailGraphics.fillStyle(color, segment.alpha).fillCircle(to.x, to.y, segment.width / 2);
    }

    // Pulsing glow and hot core around the ball (kept, dimmer, when it is slow).
    const pulse = 1 + Math.sin(this.clock * 18) * 0.06 + Math.sin(this.clock * 31) * 0.03;
    const presence = Math.max(0.25 * this.fade, intensity);
    this.glow
      .setTexture(softTexture(this.scene, style.glow))
      .setVisible(true)
      .setPosition(ballX, ballY)
      .setAlpha(0.55 * presence)
      .setScale(((style.glowRadius * 2.6) / SOFT_SIZE) * pulse);
    this.core
      .setTexture(softTexture(this.scene, style.core))
      .setVisible(true)
      .setPosition(ballX, ballY)
      .setAlpha(0.35 * presence)
      .setScale(((style.glowRadius * 1.25) / SOFT_SIZE) * pulse);

    // Particles stay where they were emitted, so the moving ball leaves them behind.
    this.emit(style, ballX, ballY, intensity, step);
  }

  clearStreak() {
    this.trail.length = 0;
    this.trailGraphics.clear();
    this.glow.setVisible(false);
    this.core.setVisible(false);
    this.emitAccumulator = 0;
    this.sparkAccumulator = 0;
    this.smokeAccumulator = 0;
  }

  /** A new power starts: fresh streak (live particles keep fading). */
  clear() {
    this.clearStreak();
  }

  /** Kickoff: nothing lingers. */
  reset() {
    this.fade = 0;
    this.style = null;
    this.clearStreak();
    this.particles.forEach((particle) => {
      particle.image.setVisible(false);
      this.pool.push(particle.image);
    });
    this.particles.length = 0;
  }

  /** Snapshot for render_game_to_text. */
  debugState() {
    return {
      kind: this.style?.kind ?? null,
      fade: Math.round(this.fade * 100) / 100,
      trailPoints: this.trail.length,
      particles: this.particles.length,
      glowVisible: this.glow.visible,
    };
  }

  destroy() {
    this.reset();
    this.trailGraphics.destroy();
    this.glow.destroy();
    this.core.destroy();
    this.pool.forEach((image) => image.destroy());
    this.pool.length = 0;
  }
}
