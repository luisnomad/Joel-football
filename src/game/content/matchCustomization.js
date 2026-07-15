const freezeItems = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export const ARENA_THEMES = freezeItems([
  {
    id: 'skycourt',
    texture: 'arena-skycourt',
    asset: 'arena-skycourt.webp',
    nameKey: 'customize.arena.skycourt',
    descriptionKey: 'customize.arena.skycourt.description',
    pitchTint: 0x2f9d55,
    accent: 0x65e7ff,
  },
  {
    id: 'neon',
    texture: 'arena-neon',
    asset: 'arena-neon.webp',
    nameKey: 'customize.arena.neon',
    descriptionKey: 'customize.arena.neon.description',
    pitchTint: 0x35116b,
    accent: 0xff4fd8,
  },
  {
    id: 'beach',
    texture: 'arena-beach',
    asset: 'arena-beach.webp',
    nameKey: 'customize.arena.beach',
    descriptionKey: 'customize.arena.beach.description',
    pitchTint: 0xd8a94f,
    accent: 0x59e2ef,
  },
]);

export const BALL_TYPES = freezeItems([
  {
    id: 'classic',
    nameKey: 'customize.ball.classic',
    descriptionKey: 'customize.ball.classic.description',
    texture: 'ball',
    family: 'football',
    shape: 'circle',
    radius: 22,
    displayWidth: 58,
    displayHeight: 58,
    restitution: 0.82,
    friction: 0.018,
    frictionAir: 0.0035,
    density: 0.001,
    maxSpeed: 25,
    speedScale: 1,
    liftScale: 1,
    gravityAssist: 0,
    wobble: 0,
  },
  {
    id: 'neon-ball',
    nameKey: 'customize.ball.neon',
    descriptionKey: 'customize.ball.neon.description',
    texture: 'ball-neon',
    family: 'football',
    shape: 'circle',
    radius: 22,
    displayWidth: 58,
    displayHeight: 58,
    restitution: 0.82,
    friction: 0.018,
    frictionAir: 0.0035,
    density: 0.001,
    maxSpeed: 25,
    speedScale: 1,
    liftScale: 1,
    gravityAssist: 0,
    wobble: 0,
  },
  {
    id: 'balloon',
    nameKey: 'customize.ball.balloon',
    descriptionKey: 'customize.ball.balloon.description',
    texture: 'ball-balloon',
    family: 'balloon',
    shape: 'circle',
    radius: 27,
    displayWidth: 68,
    displayHeight: 76,
    restitution: 0.94,
    friction: 0.008,
    frictionAir: 0.017,
    density: 0.00018,
    maxSpeed: 18,
    speedScale: 0.8,
    liftScale: 1.38,
    gravityAssist: 0.72,
    wobble: 0.11,
  },
  {
    id: 'rugby',
    nameKey: 'customize.ball.rugby',
    descriptionKey: 'customize.ball.rugby.description',
    texture: 'ball-rugby',
    family: 'rugby',
    shape: 'circle',
    radius: 23,
    displayWidth: 72,
    displayHeight: 46,
    restitution: 0.76,
    friction: 0.028,
    frictionAir: 0.0045,
    density: 0.0012,
    maxSpeed: 26,
    speedScale: 1.04,
    liftScale: 0.9,
    gravityAssist: 0,
    wobble: 0.34,
  },
  {
    id: 'soda-can',
    nameKey: 'customize.ball.sodaCan',
    descriptionKey: 'customize.ball.sodaCan.description',
    texture: 'ball-soda-can',
    family: 'can',
    shape: 'rectangle',
    bodyWidth: 28,
    bodyHeight: 50,
    radius: 27,
    displayWidth: 42,
    displayHeight: 70,
    restitution: 0.58,
    friction: 0.085,
    frictionAir: 0.007,
    density: 0.0017,
    maxSpeed: 23,
    speedScale: 0.92,
    liftScale: 0.82,
    gravityAssist: 0,
    wobble: 0.22,
  },
  {
    id: 'cannonball',
    nameKey: 'customize.ball.cannonball',
    descriptionKey: 'customize.ball.cannonball.description',
    texture: 'ball-cannonball',
    family: 'cannonball',
    shape: 'circle',
    radius: 21,
    displayWidth: 56,
    displayHeight: 56,
    restitution: 0.34,
    friction: 0.06,
    frictionAir: 0.0015,
    density: 0.0075,
    maxSpeed: 22,
    speedScale: 0.7,
    liftScale: 0.58,
    gravityAssist: 0,
    wobble: 0,
  },
]);

export const DEFAULT_ARENA_THEME_ID = 'skycourt';
export const DEFAULT_BALL_TYPE_ID = 'classic';

const getById = (items, id, fallbackId) => items.find((item) => item.id === id)
  ?? items.find((item) => item.id === fallbackId);

export const getArenaTheme = (id) => getById(ARENA_THEMES, id, DEFAULT_ARENA_THEME_ID);
export const getBallType = (id) => getById(BALL_TYPES, id, DEFAULT_BALL_TYPE_ID);
export const sanitizeArenaThemeId = (id) => getArenaTheme(id).id;
export const sanitizeBallTypeId = (id) => getBallType(id).id;

export const cycleCustomization = (items, currentId, direction = 1) => {
  const index = Math.max(0, items.findIndex((item) => item.id === currentId));
  return items[(index + (direction < 0 ? -1 : 1) + items.length) % items.length];
};

export const cycleArenaTheme = (id, direction) => cycleCustomization(ARENA_THEMES, id, direction);
export const cycleBallType = (id, direction) => cycleCustomization(BALL_TYPES, id, direction);
