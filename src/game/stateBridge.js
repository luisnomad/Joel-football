let activeScene = null;

export const setActiveScene = (scene) => {
  activeScene = scene;
};

export const clearActiveScene = (scene) => {
  if (activeScene === scene) activeScene = null;
};

export const renderActiveState = () => {
  const state = activeScene?.serializeState?.() ?? {
    mode: 'loading',
    coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720',
  };
  return JSON.stringify(state);
};

export const advanceActiveScene = (milliseconds) => {
  activeScene?.advanceForTesting?.(milliseconds);
};
