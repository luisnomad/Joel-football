export const DEFAULT_KICKFALL_THEME_ID = 'cosmic';

const imageAsset = (key, asset) => Object.freeze({ key, asset, loader: 'image' });
const svgAsset = (key, asset, width, height) => Object.freeze({
  key,
  asset,
  loader: 'svg',
  width,
  height,
});

const cosmicAssets = Object.freeze([
  imageAsset('kickfall-cosmic-backdrop', 'themes/cosmic/cosmic-backdrop-v1.webp'),
  imageAsset('kickfall-cosmic-milky-way', 'themes/cosmic/cosmic-milky-way-v1.webp'),
  imageAsset('kickfall-cosmic-moon', 'themes/cosmic/cosmic-moon-v1.webp'),
  imageAsset('kickfall-cosmic-platform', 'themes/cosmic/cosmic-platform-v1.webp'),
  imageAsset('kickfall-cosmic-gate', 'themes/cosmic/cosmic-gate-v1.png'),
  imageAsset('kickfall-cosmic-catch', 'themes/cosmic/cosmic-catch-v1.png'),
  imageAsset('kickfall-cosmic-cleat', 'themes/cosmic/cosmic-cleat-v1.png'),
]);

const workshopAssets = Object.freeze([
  svgAsset('kickfall-backdrop', 'kickfall-backdrop.svg', 1280, 720),
  svgAsset('kickfall-platform', 'kickfall-platform.svg', 512, 64),
  imageAsset('kickfall-gate', 'kickfall-gate-v2.png'),
  svgAsset('kickfall-catch-rail', 'kickfall-catch-rail.svg', 320, 80),
  imageAsset('kickfall-bumper', 'kickfall-bumper-v1.png'),
]);

const cosmic = Object.freeze({
  id: 'cosmic',
  name: 'Cosmic Foundry',
  assets: cosmicAssets,
  textureKeys: Object.freeze({
    backdrop: 'kickfall-cosmic-backdrop',
    milkyWay: 'kickfall-cosmic-milky-way',
    moon: 'kickfall-cosmic-moon',
    platform: 'kickfall-cosmic-platform',
    gate: 'kickfall-cosmic-gate',
    catchRail: 'kickfall-cosmic-catch',
    cleat: 'kickfall-cosmic-cleat',
  }),
  motion: Object.freeze({
    milkyWayCycleSeconds: 180,
    moonTravelSeconds: 90,
    starTwinkleSeconds: 4.8,
  }),
  palette: Object.freeze({
    void: 0x030817,
    lowerVoid: 0x071426,
    frame: 0x5de9ff,
    frameAlt: 0xc45dff,
    platformBody: 0x101d38,
    platformEdge: 0x67e8ff,
    platformAccent: 0x31bdf2,
    gateEnergy: 0xffa238,
    gateDamage: 0xff6d65,
    pocket: 0x4be9ff,
    cleat: 0xffb449,
    danger: 0xff4f82,
    dangerAlt: 0x793b9d,
    hud: 0x030a19,
  }),
});

const workshop = Object.freeze({
  id: 'workshop',
  name: 'Neon Workshop',
  assets: workshopAssets,
  textureKeys: Object.freeze({
    backdrop: 'kickfall-backdrop',
    milkyWay: null,
    moon: null,
    platform: 'kickfall-platform',
    gate: 'kickfall-gate',
    catchRail: 'kickfall-catch-rail',
    cleat: 'kickfall-bumper',
  }),
  motion: Object.freeze({
    milkyWayCycleSeconds: 0,
    moonTravelSeconds: 0,
    starTwinkleSeconds: 0,
  }),
  palette: Object.freeze({
    void: 0x07152d,
    lowerVoid: 0x0a1429,
    frame: 0x6eeafa,
    frameAlt: 0xff7890,
    platformBody: 0x7d2947,
    platformEdge: 0x67e8ef,
    platformAccent: 0x274b71,
    gateEnergy: 0xffcf63,
    gateDamage: 0xff6d65,
    pocket: 0x8ff8ff,
    cleat: 0xffe58b,
    danger: 0xd74467,
    dangerAlt: 0x274b71,
    hud: 0x061021,
  }),
});

export const KICKFALL_THEMES = Object.freeze({ cosmic, workshop });

export const getKickfallTheme = (themeId = DEFAULT_KICKFALL_THEME_ID) => (
  KICKFALL_THEMES[themeId] ?? KICKFALL_THEMES[DEFAULT_KICKFALL_THEME_ID]
);

export const getKickfallThemeAssets = (themeId = DEFAULT_KICKFALL_THEME_ID) => (
  getKickfallTheme(themeId).assets
);
