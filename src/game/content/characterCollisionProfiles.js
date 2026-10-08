const STANDARD_FOOTBALL = Object.freeze({
  bodyScale: 1,
  // The tallest standard idle silhouettes (Joel, Juan, and Juanjo) occupy
  // 222 world pixels from the shared foot anchor to the top hair pixel.
  headTop: 222,
});

const STANDARD_KICKFALL = Object.freeze({
  bodyScale: 1,
  strikeScale: 1,
});

/**
 * Gameplay geometry is explicit and intentionally independent from artwork
 * scaling. Dad and Mum are larger competitors by design; future characters
 * must opt into a profile instead of inheriting collision changes from a
 * visual transform.
 */
export const CHARACTER_COLLISION_PROFILES = Object.freeze({
  standard: Object.freeze({
    id: 'standard',
    football: STANDARD_FOOTBALL,
    kickfall: STANDARD_KICKFALL,
  }),
  // Sprite-redo kids (STYLE_BIBLE_SPRITES.md §3-4): the same footprint as an
  // adult, but they stand 330 px tall in the cell (193 world px) instead of
  // 380, so the head cap sits lower to match the drawing.
  kid: Object.freeze({
    id: 'kid',
    football: Object.freeze({ bodyScale: 1, headTop: 193 }),
    kickfall: STANDARD_KICKFALL,
  }),
  'dad-large': Object.freeze({
    id: 'dad-large',
    football: Object.freeze({ bodyScale: 1.2, headTop: 284 }),
    kickfall: Object.freeze({ bodyScale: 1.2, strikeScale: 1.2 }),
  }),
  'mum-large': Object.freeze({
    id: 'mum-large',
    football: Object.freeze({ bodyScale: 1.2, headTop: 266 }),
    kickfall: Object.freeze({ bodyScale: 1.2, strikeScale: 1.2 }),
  }),
});

export const DEFAULT_CHARACTER_COLLISION_PROFILE_ID = 'standard';

export const getCharacterCollisionProfile = (character) => (
  CHARACTER_COLLISION_PROFILES[character?.collisionProfile]
  ?? CHARACTER_COLLISION_PROFILES[DEFAULT_CHARACTER_COLLISION_PROFILE_ID]
);

export const getFootballCollisionGeometry = (character) => {
  const profile = getCharacterCollisionProfile(character).football;
  const bodyScale = Math.max(0.5, Number(profile.bodyScale) || 1);
  const headTop = Math.max(0, Number(profile.headTop) || 0);
  const headCapRadius = 40;
  // The compound's actual unscaled lower bound is y=70. The old calculation
  // used the sprite-position offset (89), which is not a body bound and left a
  // 19px blind strip at standard scale (22.8px for the large profiles).
  const unscaledBodyBottomY = 70;
  const headCapY = headTop > 0
    ? Math.min(-76, unscaledBodyBottomY + headCapRadius - headTop / bodyScale)
    : -76;
  return Object.freeze({
    bodyScale,
    headTop,
    headCapY,
  });
};

export const getKickfallCollisionGeometry = (
  character,
  {
    baseWidth = 44,
    baseHeight = 82,
    baseChamferRadius = 13,
    baseFootForwardOffset = 30,
    baseFootVerticalOffset = 24,
    baseFootRadius = 8,
  } = {},
) => {
  const profile = getCharacterCollisionProfile(character).kickfall;
  const bodyScale = Math.max(0.5, Number(profile.bodyScale) || 1);
  const strikeScale = Math.max(0.5, Number(profile.strikeScale) || bodyScale);
  return Object.freeze({
    bodyScale,
    bodyWidth: baseWidth * bodyScale,
    bodyHeight: baseHeight * bodyScale,
    chamferRadius: baseChamferRadius * bodyScale,
    footForwardOffset: baseFootForwardOffset * strikeScale,
    footVerticalOffset: baseFootVerticalOffset * strikeScale,
    footRadius: baseFootRadius * strikeScale,
  });
};
