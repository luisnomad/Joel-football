import { getCharacterLayout } from '../pure/characterAnimation.js';

export const DEFAULT_PLAYER_CHARACTER_ID = 'joel';
export const DEFAULT_OPPONENT_ID = 'bob';

/**
 * Fallback kick reach (world px from the player center to the boot tip on
 * the contact drawing) for characters without a measured kickReach.
 */
export const DEFAULT_KICK_REACH = 80;
export const LEGACY_CHARACTER_ID_ALIASES = Object.freeze({ vex: 'bob' });

export const CHARACTERS = Object.freeze([
  Object.freeze({
    id: 'joel',
    name: 'Joel',
    label: 'JOEL',
    names: Object.freeze({ en: 'Joel', es: 'Joel' }),
    labels: Object.freeze({ en: 'JOEL', es: 'JOEL' }),
    portraitTexture: 'joel',
    sheetTexture: 'joel-sheet',
    portraitAsset: 'player-joel-portrait.png',
    sheetAsset: 'player-joel-sheet-v2.webp',
    // Sprite redo: 24-frame roster-v2 atlas, strict side view facing right.
    atlasLayout: 'roster-v2',
    nativeFacing: 1,
    accent: 0x6ef4ff,
    kickReach: 76,
    chilenaContact: Object.freeze({ x: 237, y: 143 }),
    collisionProfile: 'kid',
    // Kids stand shorter (lower head reach); +0.03 jump keeps headers fair.
    stats: Object.freeze({ speed: 1.08, jump: 1.07, kick: 1, dash: 1, power: 1 }),
  }),
  Object.freeze({
    id: 'bob',
    name: 'Bob',
    label: 'BOB',
    names: Object.freeze({ en: 'Bob', es: 'Bob' }),
    labels: Object.freeze({ en: 'BOB', es: 'BOB' }),
    portraitTexture: 'bob',
    sheetTexture: 'bob-sheet',
    portraitAsset: 'player-bob-portrait.png',
    sheetAsset: 'player-bob-sheet-v3.webp',
    // Sprite-redo pilot: 24-frame roster-v2 atlas, strict side view facing right.
    atlasLayout: 'roster-v2',
    nativeFacing: 1,
    accent: 0xffad72,
    kickReach: 73,
    // Boot point on the chilena contact drawing (source px in the 336x480 cell).
    chilenaContact: Object.freeze({ x: 210, y: 141 }),
    collisionProfile: 'kid',
    // Kids stand shorter (lower head reach); +0.03 jump keeps headers fair.
    stats: Object.freeze({ speed: 1, jump: 1.11, kick: 1.04, dash: 1, power: 1.05 }),
  }),
  Object.freeze({
    id: 'lucia',
    name: 'Lucia',
    label: 'LUCIA',
    names: Object.freeze({ en: 'Lucia', es: 'Lucia' }),
    labels: Object.freeze({ en: 'LUCIA', es: 'LUCIA' }),
    portraitTexture: 'lucia',
    sheetTexture: 'lucia-sheet',
    portraitAsset: 'player-lucia-portrait.png',
    sheetAsset: 'player-lucia-sheet-v3.webp',
    atlasLayout: 'roster-v2',
    nativeFacing: 1,
    accent: 0x5ff3e2,
    kickReach: 93,
    chilenaContact: Object.freeze({ x: 237, y: 95 }),
    stats: Object.freeze({ speed: 1.04, jump: 1.04, kick: 1.02, dash: 1.04, power: 1.04 }),
  }),
  Object.freeze({
    id: 'luna',
    name: 'Luna',
    label: 'LUNA',
    names: Object.freeze({ en: 'Luna', es: 'Luna' }),
    labels: Object.freeze({ en: 'LUNA', es: 'LUNA' }),
    portraitTexture: 'luna',
    sheetTexture: 'luna-sheet',
    portraitAsset: 'player-luna-portrait.png',
    sheetAsset: 'player-luna-sheet-v3.webp',
    atlasLayout: 'roster-v2',
    nativeFacing: 1,
    accent: 0xc79aff,
    kickReach: 80,
    chilenaContact: Object.freeze({ x: 227, y: 156 }),
    collisionProfile: 'kid',
    stats: Object.freeze({ speed: 1.05, jump: 1.09, kick: 1, dash: 1.04, power: 1.02 }),
  }),
  Object.freeze({
    id: 'juan',
    name: 'Uncle Juan',
    label: 'UNCLE JUAN',
    names: Object.freeze({ en: 'Uncle Juan', es: 'Tío Juan' }),
    labels: Object.freeze({ en: 'UNCLE JUAN', es: 'TÍO JUAN' }),
    portraitTexture: 'juan',
    sheetTexture: 'juan-sheet',
    portraitAsset: 'player-juan-portrait.png',
    sheetAsset: 'player-juan-sheet-v3.webp',
    nativeFacing: 1,
    accent: 0x55e0d0,
    kickReach: 83,
    stats: Object.freeze({ speed: 0.98, jump: 1, kick: 1.06, dash: 0.98, power: 1.08 }),
  }),
  Object.freeze({
    id: 'dad',
    name: 'Dad',
    label: 'DAD',
    names: Object.freeze({ en: 'Dad', es: 'Papá' }),
    labels: Object.freeze({ en: 'DAD', es: 'PAPÁ' }),
    portraitTexture: 'dad',
    sheetTexture: 'dad-sheet',
    portraitAsset: 'player-dad-portrait.png',
    sheetAsset: 'player-dad-sheet-v1.webp',
    nativeFacing: 1,
    accent: 0xffc43d,
    kickReach: 106,
    visualScale: 1.2,
    collisionProfile: 'dad-large',
    // The wide action poses were shrunk by the atlas margin enforcer (heads
    // read ~20% small); restore their presence at display time. Kick frames
    // and the chilena drawing (3) are the worst. The jump drawing (2) is
    // oversized instead, so it is pulled down the other way.
    frameScales: Object.freeze({ 2: 0.92, 3: 1.12, 9: 1.1, 10: 1.15, 11: 1.18 }),
    stats: Object.freeze({ speed: 0.98, jump: 0.98, kick: 1.04, dash: 0.98, power: 1.08 }),
  }),
  Object.freeze({
    id: 'mum',
    name: 'Mum',
    label: 'MUM',
    names: Object.freeze({ en: 'Mum', es: 'Mamá' }),
    labels: Object.freeze({ en: 'MUM', es: 'MAMÁ' }),
    portraitTexture: 'mum',
    sheetTexture: 'mum-sheet',
    portraitAsset: 'player-mum-portrait.png',
    sheetAsset: 'player-mum-sheet-v1.webp',
    nativeFacing: 1,
    accent: 0x6ca8ff,
    kickReach: 100,
    visualScale: 1.2,
    collisionProfile: 'mum-large',
    // Milder version of Dad's issue: kick and jump frames read slightly small.
    frameScales: Object.freeze({ 2: 1.08, 3: 1.1, 9: 1.08, 10: 1.08, 11: 1.1 }),
    stats: Object.freeze({ speed: 1.02, jump: 1.04, kick: 1.02, dash: 1.04, power: 1.04 }),
  }),
  Object.freeze({
    id: 'juanjo',
    name: 'Uncle Juanjo',
    label: 'UNCLE JUANJO',
    names: Object.freeze({ en: 'Uncle Juanjo', es: 'Tío Juanjo' }),
    labels: Object.freeze({ en: 'UNCLE JUANJO', es: 'TÍO JUANJO' }),
    portraitTexture: 'juanjo',
    sheetTexture: 'juanjo-sheet',
    portraitAsset: 'player-juanjo-portrait.png',
    sheetAsset: 'player-juanjo-sheet-v1.webp',
    nativeFacing: 1,
    accent: 0xff8298,
    kickReach: 88,
    stats: Object.freeze({ speed: 1.02, jump: 0.98, kick: 1.04, dash: 1.04, power: 1.06 }),
  }),
]);

export const getCharacterName = (character, language = 'en') => (
  character?.names?.[language] ?? character?.name ?? ''
);

export const getCharacterLabel = (character, language = 'en') => (
  character?.labels?.[language] ?? character?.label ?? ''
);

export const getCharacterVisualScale = (character) => (
  Math.min(1.2, Math.max(0.85, Number(character?.visualScale) || 1))
);

/**
 * Per-frame display enlargement for drawings the atlas pipeline had to shrink
 * to fit the 320 px cell (wide action poses lose head size when scaled down).
 * Applied to the visual sprite only, around the ground anchor, so feet stay
 * planted and the collider is untouched. If the frames are ever re-authored
 * at consistent scale, drop the character's frameScales entry.
 */
export const getCharacterFrameScale = (character, frame) => {
  const scales = character?.frameScales;
  if (!scales) return 1;
  const factor = Number(scales[frame]);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
};

/**
 * World-px distance from the character's center to the boot tip on the kick
 * contact drawing, measured from each sprite sheet at the character's native
 * visualScale. Drives the strike capsule so kicks connect when the boot
 * visibly reaches the ball instead of a fixed oversized pole for everyone.
 */
export const getCharacterKickReach = (character) => {
  const reach = Number(character?.kickReach);
  return Number.isFinite(reach) && reach > 0 ? reach : DEFAULT_KICK_REACH;
};

/** Phaser spritesheet frame size for the character's atlas layout. */
export const getCharacterSheetFrameConfig = (character) => {
  const layout = getCharacterLayout(character);
  return { frameWidth: layout.frameWidth, frameHeight: layout.frameHeight };
};

export const normalizeCharacterId = (id) => LEGACY_CHARACTER_ID_ALIASES[id] ?? id;

export const getCharacter = (id, fallbackId = DEFAULT_PLAYER_CHARACTER_ID) => (
  CHARACTERS.find((character) => character.id === normalizeCharacterId(id))
  ?? CHARACTERS.find((character) => character.id === normalizeCharacterId(fallbackId))
  ?? CHARACTERS[0]
);

export const cycleCharacter = ({ id, direction = 1, excludedId = null } = {}) => {
  const available = CHARACTERS.filter((character) => character.id !== excludedId);
  const currentIndex = Math.max(0, available.findIndex((character) => character.id === id));
  const offset = direction < 0 ? -1 : 1;
  return available[(currentIndex + offset + available.length) % available.length];
};

export const sanitizeLineup = ({ playerCharacterId, opponentId } = {}) => {
  const player = getCharacter(playerCharacterId, DEFAULT_PLAYER_CHARACTER_ID);
  const requestedOpponent = getCharacter(opponentId, DEFAULT_OPPONENT_ID);
  const opponent = requestedOpponent.id === player.id
    ? CHARACTERS.find((character) => character.id !== player.id)
    : requestedOpponent;
  return { playerCharacterId: player.id, opponentId: opponent.id };
};
