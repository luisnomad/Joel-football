/**
 * Visual identity of an empowered ball, independent of Phaser so it can be
 * tested. Each shot type gets its own look instead of one tinted sticker:
 *   energy  - the standard full-meter power shot (owner colour sparks)
 *   fire    - Fireball and the chilenas (flames, embers, smoke)
 *   gold    - the Big Guy shot (gold sparkles)
 * The effect scales with ball speed, so a blocked or stopped power ball calms
 * down instead of wearing a full comet, and it fades out when the power ends.
 */

export const POWER_BALL_FADE_SECONDS = 0.25;
/** Below this speed (px/tick) the effect is fully calm; above FULL it is at full strength. */
export const POWER_BALL_CALM_SPEED = 3;
export const POWER_BALL_FULL_SPEED = 17;
/** Trail samples kept (one per fixed step). */
export const POWER_BALL_TRAIL_POINTS = 12;

const OWNER_ENERGY = Object.freeze({
  left: Object.freeze({ glow: 0x3fe6ff, core: 0xe9fdff, particles: Object.freeze([0x9ff8ff, 0x2fd6ff, 0x1478c8]) }),
  right: Object.freeze({ glow: 0xff8a2a, core: 0xfff1df, particles: Object.freeze([0xffd08a, 0xff8a2a, 0xc8401a]) }),
});

// Saturated from birth: pale starts read as white puffs on the bright pitch.
const FIRE_PARTICLES = Object.freeze([0xffe066, 0xffa21f, 0xff5a1a, 0xc8281a, 0x5a1e14]);
const GOLD_PARTICLES = Object.freeze([0xfff1a0, 0xffc93a, 0xe08a12]);

export const POWER_BALL_STYLES = Object.freeze({
  energy: Object.freeze({
    kind: 'energy',
    glowRadius: 34,
    trailWidth: 30,
    emitPerSecond: 70,
    particleLife: 0.22,
    particleScale: 0.6,
    rise: 0,
    sparksPerSecond: 26,
    smoke: false,
  }),
  fire: Object.freeze({
    kind: 'fire',
    glowRadius: 44,
    trailWidth: 40,
    emitPerSecond: 150,
    particleLife: 0.34,
    particleScale: 0.85,
    rise: 46,
    sparksPerSecond: 34,
    smoke: true,
  }),
  gold: Object.freeze({
    kind: 'gold',
    glowRadius: 36,
    trailWidth: 26,
    emitPerSecond: 50,
    particleLife: 0.3,
    particleScale: 0.55,
    rise: -10,
    sparksPerSecond: 40,
    smoke: false,
  }),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Style plus resolved colours for the current power ball. */
export const getPowerBallStyle = ({ superpowerId = null, owner = 'left', color = null } = {}) => {
  if (superpowerId === 'fireball' || superpowerId === 'chilena' || superpowerId === 'chilena-lob') {
    return {
      ...POWER_BALL_STYLES.fire,
      glow: superpowerId === 'fireball' ? 0xff7a1f : 0xff5a24,
      core: 0xfff4c2,
      particles: FIRE_PARTICLES,
      trailHead: 0xffc23a,
      trailTail: 0xd8371a,
    };
  }
  if (superpowerId === 'big') {
    return {
      ...POWER_BALL_STYLES.gold,
      glow: 0xffc653,
      core: 0xfffbe0,
      particles: GOLD_PARTICLES,
      trailHead: 0xffdf6b,
      trailTail: 0xf2a922,
    };
  }
  const energy = OWNER_ENERGY[owner === 'right' ? 'right' : 'left'];
  const glow = Number.isFinite(color) && color !== null ? color : energy.glow;
  return {
    ...POWER_BALL_STYLES.energy,
    glow,
    core: energy.core,
    particles: energy.particles,
    trailHead: glow,
    trailTail: energy.particles[2],
  };
};

/**
 * 0..1 strength of the effect: grows with ball speed and with the fade-in /
 * fade-out envelope (`fade`, 0..1).
 */
export const powerBallIntensity = ({ speed = 0, fade = 1 } = {}) => {
  const bySpeed = clamp(
    (Math.abs(Number(speed) || 0) - POWER_BALL_CALM_SPEED) / (POWER_BALL_FULL_SPEED - POWER_BALL_CALM_SPEED),
    0,
    1,
  );
  return bySpeed * clamp(Number(fade) || 0, 0, 1);
};

/** Next fade envelope value: rises while the power is active, falls after it ends. */
export const stepPowerBallFade = ({ fade = 0, active = false, dt = 0 } = {}) => {
  const step = (Math.max(0, Number(dt) || 0)) / POWER_BALL_FADE_SECONDS;
  return clamp((Number(fade) || 0) + (active ? step : -step), 0, 1);
};

/**
 * Width and alpha of trail segment `index` (0 = at the ball) for a trail of
 * `count` points: a tapered streak instead of stacked circles.
 */
export const trailSegmentAt = (index, count, { trailWidth, intensity = 1 }) => {
  const along = count <= 1 ? 0 : index / (count - 1);
  return {
    width: Math.max(1, trailWidth * (1 - along) ** 1.4 * (0.45 + 0.55 * intensity)),
    alpha: clamp((1 - along) ** 0.8 * 0.85 * intensity, 0, 1),
  };
};

/** Mix two 0xRRGGBB colours (t = 0 gives a, 1 gives b). */
export const mixColor = (a, b, t) => {
  const k = clamp(Number(t) || 0, 0, 1);
  const channel = (shift) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

