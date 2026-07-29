const entries = Object.freeze({
  kickfall: Object.freeze({
    id: 'kickfall',
    sceneKey: 'Kickfall',
    title: 'KICKFALL',
    loadingKey: 'kickfall.loadingCode',
    errorKey: 'kickfall.loadingError',
    load: () => import('./kickfall/KickfallScene.js')
      .then(({ KickfallScene }) => KickfallScene),
  }),
  discHockey: Object.freeze({
    id: 'discHockey',
    sceneKey: 'DiscHockey',
    title: 'DISC HOCKEY',
    loadingKey: 'discHockey.loadingCode',
    errorKey: 'discHockey.loadingError',
    load: () => import('./discHockey/DiscHockeyScene.js')
      .then(({ DiscHockeyScene }) => DiscHockeyScene),
  }),
});

export const MINI_GAME_IDS = Object.freeze(Object.keys(entries));

export const getMiniGameEntry = (gameId) => entries[gameId] ?? entries.kickfall;

export const loadMiniGameScene = async (gameId) => {
  const entry = getMiniGameEntry(gameId);
  return { entry, SceneClass: await entry.load() };
};
