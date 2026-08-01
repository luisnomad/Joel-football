import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';

export const BASE_STAGE_ASPECT = GAME_WIDTH / GAME_HEIGHT;
export const TABLET_MIN_SHORT_SIDE = 600;
export const TABLET_ASPECT_TOLERANCE = 0.035;
export const WIDE_PHONE_ASPECT_TOLERANCE = 0.06;
export const COMPACT_PHONE_MAX_SHORT_SIDE = 520;

export const shouldExtendTabletStage = ({
  viewportWidth,
  viewportHeight,
  coarsePointer = false,
  touchPoints = 0,
  forceLandscape = false,
} = {}) => {
  const rawWidth = Math.max(0, Number(viewportWidth) || 0);
  const rawHeight = Math.max(0, Number(viewportHeight) || 0);
  const width = forceLandscape ? Math.max(rawWidth, rawHeight) : rawWidth;
  const height = forceLandscape ? Math.min(rawWidth, rawHeight) : rawHeight;
  if (width <= height || height < TABLET_MIN_SHORT_SIDE) return false;
  if (!coarsePointer && touchPoints <= 0) return false;
  return width / height < BASE_STAGE_ASPECT - TABLET_ASPECT_TOLERANCE;
};

export const detectExtendedTabletStage = ({ forceLandscape = false } = {}) => shouldExtendTabletStage({
  viewportWidth: globalThis.innerWidth,
  viewportHeight: globalThis.innerHeight,
  coarsePointer: globalThis.matchMedia?.('(pointer: coarse)').matches ?? false,
  touchPoints: globalThis.navigator?.maxTouchPoints ?? 0,
  forceLandscape,
});

export const shouldExpandWidePhoneStage = ({
  viewportWidth,
  viewportHeight,
  coarsePointer = false,
  touchPoints = 0,
  forceLandscape = false,
} = {}) => {
  const rawWidth = Math.max(0, Number(viewportWidth) || 0);
  const rawHeight = Math.max(0, Number(viewportHeight) || 0);
  const width = forceLandscape ? Math.max(rawWidth, rawHeight) : rawWidth;
  const height = forceLandscape ? Math.min(rawWidth, rawHeight) : rawHeight;
  if (width <= height) return false;
  if (!coarsePointer && touchPoints <= 0) return false;
  return width / height > BASE_STAGE_ASPECT + WIDE_PHONE_ASPECT_TOLERANCE;
};

export const detectWidePhoneStage = () => {
  const coarsePointer = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchPoints = globalThis.navigator?.maxTouchPoints ?? 0;
  const viewportMatch = shouldExpandWidePhoneStage({
    viewportWidth: globalThis.visualViewport?.width ?? globalThis.innerWidth,
    viewportHeight: globalThis.visualViewport?.height ?? globalThis.innerHeight,
    coarsePointer,
    touchPoints,
  });
  if (viewportMatch) return true;

  // Mobile Safari / installed PWAs may expose the initial portrait viewport
  // before the requested landscape orientation settles. The screen dimensions
  // are stable during that race, so evaluate their eventual landscape shape.
  // Some native WebViews expose physical screen pixels here; normalizing by
  // devicePixelRatio keeps the phone/tablet short-side threshold in CSS pixels.
  const deviceScale = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  return shouldExpandWidePhoneStage({
    viewportWidth: (globalThis.screen?.availWidth ?? globalThis.screen?.width) / deviceScale,
    viewportHeight: (globalThis.screen?.availHeight ?? globalThis.screen?.height) / deviceScale,
    coarsePointer,
    touchPoints,
    forceLandscape: true,
  });
};

export const shouldUseCompactPhoneUi = ({
  viewportWidth,
  viewportHeight,
  coarsePointer = false,
  touchPoints = 0,
  mobileUserAgent = false,
} = {}) => {
  const width = Math.max(0, Number(viewportWidth) || 0);
  const height = Math.max(0, Number(viewportHeight) || 0);
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  if (longSide <= shortSide || shortSide <= 0) return false;
  if (!coarsePointer && touchPoints <= 0) return false;
  if (shortSide <= COMPACT_PHONE_MAX_SHORT_SIDE) return true;
  return mobileUserAgent && shortSide < TABLET_MIN_SHORT_SIDE;
};

export const detectCompactPhoneUi = () => {
  const viewport = globalThis.visualViewport;
  const userAgent = globalThis.navigator?.userAgent ?? '';
  const mobileUserAgent = globalThis.navigator?.userAgentData?.mobile
    ?? /Mobile|iPhone|iPod/i.test(userAgent);
  return shouldUseCompactPhoneUi({
    viewportWidth: viewport?.width ?? globalThis.innerWidth,
    viewportHeight: viewport?.height ?? globalThis.innerHeight,
    coarsePointer: globalThis.matchMedia?.('(pointer: coarse)').matches ?? false,
    touchPoints: globalThis.navigator?.maxTouchPoints ?? 0,
    mobileUserAgent,
  });
};

export const usesCompactPhoneUi = (scene) => (
  scene?.game?.registry?.get('compactPhoneUi') === true
);

export const getWideStageUiScale = (layout) => {
  const width = Math.max(GAME_WIDTH, Number(layout?.width) || GAME_WIDTH);
  if (width < GAME_WIDTH + 24) return 1;
  return Math.min(1.12, width / GAME_WIDTH);
};

export const createStageLayout = ({ width = GAME_WIDTH, height = GAME_HEIGHT } = {}) => {
  const stageWidth = Math.max(GAME_WIDTH, Math.round(Number(width) || GAME_WIDTH));
  const stageHeight = Math.max(GAME_HEIGHT, Math.round(Number(height) || GAME_HEIGHT));
  const extraHeight = stageHeight - GAME_HEIGHT;
  return Object.freeze({
    extended: extraHeight >= 24,
    width: stageWidth,
    height: stageHeight,
    gameplayWidth: GAME_WIDTH,
    gameplayHeight: GAME_HEIGHT,
    extraHeight,
    bottomOffset: extraHeight,
  });
};

export const getSceneStageLayout = (scene) => createStageLayout({
  width: scene?.scale?.gameSize?.width,
  height: scene?.scale?.gameSize?.height,
});
