import {
  detectCompactPhoneUi,
  detectExtendedTabletStage,
  detectWidePhoneStage,
  shouldUseCompactPhoneUi,
} from '../game/layout/tabletStage.js';

const round = (value, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export const createDeviceProfile = ({ platformServices } = {}) => {
  const devicePixelRatio = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  const rawViewportWidth = Math.max(1, Number(globalThis.visualViewport?.width ?? globalThis.innerWidth) || 1);
  const rawViewportHeight = Math.max(1, Number(globalThis.visualViewport?.height ?? globalThis.innerHeight) || 1);
  const rawScreenWidth = Math.max(0, Number(globalThis.screen?.availWidth ?? globalThis.screen?.width) || 0);
  const rawScreenHeight = Math.max(0, Number(globalThis.screen?.availHeight ?? globalThis.screen?.height) || 0);
  const screenUsesPhysicalPixels = Math.max(rawScreenWidth, rawScreenHeight) > 1600 && devicePixelRatio > 1;
  const screenCssWidth = rawScreenWidth / (screenUsesPhysicalPixels ? devicePixelRatio : 1);
  const screenCssHeight = rawScreenHeight / (screenUsesPhysicalPixels ? devicePixelRatio : 1);
  const maxTouchPoints = Math.max(0, Number(globalThis.navigator?.maxTouchPoints) || 0);
  const coarsePointer = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touch = coarsePointer || maxTouchPoints > 0;
  const native = platformServices?.native === true;
  const platform = platformServices?.platform ?? 'web';
  // The native activity locks to landscape, but Android can expose one early
  // portrait WebView measurement. Use the stable screen shape for that boot
  // frame so the correct resource bundle is chosen before Phaser imports it.
  const nativeViewportUninitialized = native && Math.min(rawViewportWidth, rawViewportHeight) < 100;
  const useEventualNativeLandscape = native
    && (rawViewportWidth < rawViewportHeight || nativeViewportUninitialized);
  const viewportWidth = useEventualNativeLandscape
    ? Math.max(screenCssWidth || rawViewportWidth, screenCssHeight || rawViewportHeight)
    : rawViewportWidth;
  const viewportHeight = useEventualNativeLandscape
    ? Math.min(screenCssWidth || rawViewportWidth, screenCssHeight || rawViewportHeight)
    : rawViewportHeight;
  const longSide = Math.max(viewportWidth, viewportHeight);
  const shortSide = Math.min(viewportWidth, viewportHeight);
  const extendedTabletStage = detectExtendedTabletStage({ forceLandscape: native });
  const wideStage = detectWidePhoneStage();
  const compactPhoneUi = detectCompactPhoneUi() || (native && shouldUseCompactPhoneUi({
    viewportWidth,
    viewportHeight,
    coarsePointer,
    touchPoints: maxTouchPoints,
    mobileUserAgent: true,
  }));
  const formFactor = compactPhoneUi || (native && touch && shortSide < 600)
    ? 'phone'
    : touch && shortSide >= 600
      ? 'tablet'
      : 'desktop';
  const aspectRatio = longSide / shortSide;
  const resourceProfile = compactPhoneUi ? 'compact-phone' : formFactor === 'tablet' ? 'tablet' : 'standard';

  return Object.freeze({
    version: 1,
    runtime: native ? 'native' : 'web',
    platform,
    formFactor,
    resourceProfile,
    orientation: viewportWidth >= viewportHeight ? 'landscape' : 'portrait',
    viewport: Object.freeze({
      width: round(viewportWidth),
      height: round(viewportHeight),
      longSide: round(longSide),
      shortSide: round(shortSide),
      aspectRatio: round(aspectRatio),
    }),
    screen: Object.freeze({
      width: round(screenCssWidth),
      height: round(screenCssHeight),
    }),
    pixels: Object.freeze({
      devicePixelRatio: round(devicePixelRatio),
      viewportWidth: Math.round(viewportWidth * devicePixelRatio),
      viewportHeight: Math.round(viewportHeight * devicePixelRatio),
      screenWidth: Math.round(screenCssWidth * devicePixelRatio),
      screenHeight: Math.round(screenCssHeight * devicePixelRatio),
    }),
    input: Object.freeze({ touch, coarsePointer, maxTouchPoints }),
    layout: Object.freeze({
      compactPhoneUi,
      extendedTabletStage,
      wideStage,
      ultraWide: aspectRatio >= 2,
      variant: compactPhoneUi
        ? 'compact-phone'
        : extendedTabletStage
          ? 'extended-tablet'
          : wideStage
            ? 'wide-stage'
            : 'standard',
    }),
  });
};

export const publishDeviceProfile = (profile, root = globalThis.document?.documentElement) => {
  globalThis.__JOEL_DEVICE__ = profile;
  if (!root) return profile;
  const managedPrefixes = ['runtime-', 'platform-', 'form-', 'orientation-', 'layout-', 'resources-', 'aspect-'];
  [...root.classList].forEach((className) => {
    if (managedPrefixes.some((prefix) => className.startsWith(prefix))) root.classList.remove(className);
  });
  root.classList.add(
    `runtime-${profile.runtime}`,
    `platform-${profile.platform}`,
    `form-${profile.formFactor}`,
    `orientation-${profile.orientation}`,
    `layout-${profile.layout.variant}`,
    `resources-${profile.resourceProfile}`,
    profile.layout.ultraWide ? 'aspect-ultrawide' : 'aspect-regular',
  );
  root.dataset.deviceProfile = profile.resourceProfile;
  root.style.setProperty('--device-viewport-width', `${profile.viewport.width}px`);
  root.style.setProperty('--device-viewport-height', `${profile.viewport.height}px`);
  root.style.setProperty('--device-pixel-ratio', String(profile.pixels.devicePixelRatio));
  return profile;
};
