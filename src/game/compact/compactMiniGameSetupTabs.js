import { t } from '../i18n.js';
import { createCompactTabs } from './compactUi.js';

export const COMPACT_MINI_GAME_SETUP_TAB_IDS = Object.freeze([
  'players',
  'setup',
  'howToPlay',
]);

const LEGACY_TAB_ALIASES = Object.freeze({
  player: 'players',
  mission: 'setup',
  match: 'setup',
  controls: 'howToPlay',
});

export const normalizeCompactMiniGameSetupTab = (value) => {
  const normalized = LEGACY_TAB_ALIASES[value] ?? value;
  return COMPACT_MINI_GAME_SETUP_TAB_IDS.includes(normalized) ? normalized : 'players';
};

export const createCompactMiniGameSetupTabs = (scene, {
  language,
  activeTab,
  onSelect,
}) => createCompactTabs(scene, {
  tabs: [
    { id: 'players', label: t(language, 'miniGameSetup.players'), color: 0x20d9ff },
    { id: 'setup', label: t(language, 'miniGameSetup.setup'), color: 0x20d9ff },
    { id: 'howToPlay', label: t(language, 'miniGameSetup.howToPlay'), color: 0x20d9ff },
  ],
  activeId: activeTab,
  width: 930,
  onSelect,
});
