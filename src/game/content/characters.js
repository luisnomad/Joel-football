export const DEFAULT_PLAYER_CHARACTER_ID = 'joel';
export const DEFAULT_OPPONENT_ID = 'bob';

export const CHARACTERS = Object.freeze([
  Object.freeze({
    id: 'joel',
    name: 'Joel',
    label: 'JOEL',
    names: Object.freeze({ en: 'Joel', es: 'Joel' }),
    labels: Object.freeze({ en: 'JOEL', es: 'JOEL' }),
    portraitTexture: 'joel',
    sheetTexture: 'joel-sheet',
    nativeFacing: 1,
    accent: 0x6ef4ff,
    stats: Object.freeze({ speed: 1.08, jump: 1.04, kick: 1, dash: 1, power: 1 }),
  }),
  Object.freeze({
    id: 'bob',
    name: 'Bob',
    label: 'BOB',
    names: Object.freeze({ en: 'Bob', es: 'Bob' }),
    labels: Object.freeze({ en: 'BOB', es: 'BOB' }),
    portraitTexture: 'vex',
    sheetTexture: 'vex-sheet',
    nativeFacing: -1,
    accent: 0xffad72,
    stats: Object.freeze({ speed: 1, jump: 1.08, kick: 1.04, dash: 1, power: 1.05 }),
  }),
  Object.freeze({
    id: 'lucia',
    name: 'Lucia',
    label: 'LUCIA',
    names: Object.freeze({ en: 'Lucia', es: 'Lucia' }),
    labels: Object.freeze({ en: 'LUCIA', es: 'LUCIA' }),
    portraitTexture: 'lucia',
    sheetTexture: 'lucia-sheet',
    nativeFacing: -1,
    accent: 0x5ff3e2,
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
    nativeFacing: -1,
    accent: 0xc79aff,
    stats: Object.freeze({ speed: 1.05, jump: 1.06, kick: 1, dash: 1.04, power: 1.02 }),
  }),
  Object.freeze({
    id: 'juan',
    name: 'Uncle Juan',
    label: 'UNCLE JUAN',
    names: Object.freeze({ en: 'Uncle Juan', es: 'Tío Juan' }),
    labels: Object.freeze({ en: 'UNCLE JUAN', es: 'TÍO JUAN' }),
    portraitTexture: 'juan',
    sheetTexture: 'juan-sheet',
    nativeFacing: 1,
    accent: 0x55e0d0,
    stats: Object.freeze({ speed: 0.98, jump: 1, kick: 1.06, dash: 0.98, power: 1.08 }),
  }),
  Object.freeze({
    id: 'juanjo',
    name: 'Uncle Juanjo',
    label: 'UNCLE JUANJO',
    names: Object.freeze({ en: 'Uncle Juanjo', es: 'Tío Juanjo' }),
    labels: Object.freeze({ en: 'UNCLE JUANJO', es: 'TÍO JUANJO' }),
    portraitTexture: 'juanjo',
    sheetTexture: 'juanjo-sheet',
    nativeFacing: 1,
    accent: 0xff8298,
    stats: Object.freeze({ speed: 1.02, jump: 0.98, kick: 1.04, dash: 1.04, power: 1.06 }),
  }),
]);

export const getCharacterName = (character, language = 'en') => (
  character?.names?.[language] ?? character?.name ?? ''
);

export const getCharacterLabel = (character, language = 'en') => (
  character?.labels?.[language] ?? character?.label ?? ''
);

export const getCharacter = (id, fallbackId = DEFAULT_PLAYER_CHARACTER_ID) => (
  CHARACTERS.find((character) => character.id === id)
  ?? CHARACTERS.find((character) => character.id === fallbackId)
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
