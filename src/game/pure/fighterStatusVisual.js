/**
 * Which power/status visuals a fighter shows. The Canvas renderer ignores
 * tints and preFX glows, so every status is drawn as shapes or baked textures
 * (see effects/FighterStatusEffects.js); this decides what to draw.
 */
export const STATUS_HALO_COLORS = Object.freeze({
  frozen: 0x8fe9ff,
  shield: 0x55e0ee,
  hyper: 0x8dff70,
  bigGuy: 0xffc95c,
  chilena: 0xff7b32,
  armedLeft: 0x62f5ff,
  armedRight: 0xff9b42,
});

/** Seconds the Big Guy "pop" ring and sparks last after the power starts. */
export const BIG_GUY_POP_SECONDS = 0.45;

export const fighterStatusVisual = ({
  freezeTimer = 0,
  shieldTimer = 0,
  hyperTimer = 0,
  bigGuyActive = false,
  powerArmed = 0,
  chilenaActive = false,
  side = 'left',
} = {}) => {
  const frozen = freezeTimer > 0;
  const shield = !frozen && shieldTimer > 0;
  const hyper = !frozen && hyperTimer > 0;
  let halo = null;
  if (frozen) halo = 'frozen';
  else if (shield) halo = 'shield';
  else if (hyper) halo = 'hyper';
  else if (bigGuyActive) halo = 'bigGuy';
  else if (powerArmed > 0) halo = side === 'left' ? 'armedLeft' : 'armedRight';
  // The chilena glow wins while the overhead kick is in the air.
  if (chilenaActive && !frozen) halo = 'chilena';
  return {
    halo,
    haloColor: halo ? STATUS_HALO_COLORS[halo] : null,
    iceBlock: frozen,
    shieldBubble: shield,
    speedLines: hyper,
  };
};

/** 0 → 1 progress of the Big Guy pop, or null when no pop is showing. */
export const bigGuyPopProgress = (secondsSinceStart) => {
  if (!Number.isFinite(secondsSinceStart) || secondsSinceStart < 0 || secondsSinceStart >= BIG_GUY_POP_SECONDS) return null;
  return secondsSinceStart / BIG_GUY_POP_SECONDS;
};
