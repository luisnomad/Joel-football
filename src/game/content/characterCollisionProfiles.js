const STANDARD_FOOTBALL = Object.freeze({
  bodyScale: 1,
  headTop: 0,
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
  const unscaledFootReferenceY = 89;
  const headCapY = headTop > 0
    ? Math.min(-76, unscaledFootReferenceY + headCapRadius - headTop / bodyScale)
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
