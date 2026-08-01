import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants.js';
import { advanceActiveScene, renderActiveState } from './game/stateBridge.js';
import { BootScene } from './game/scenes/BootScene.js';
import { MatchScene } from './game/scenes/MatchScene.js';
import { MatchLoadingScene } from './game/scenes/MatchLoadingScene.js';
import { SplashScene } from './game/scenes/SplashScene.js';
import { MiniGameLoadingScene } from './game/scenes/MiniGameLoadingScene.js';
import { arcadeAudio } from './game/services/ArcadeAudio.js';
import { PLATFORM_EVENTS } from './platform/PlatformServices.js';
import { createPlatformServices } from './platform/createPlatformServices.js';
import { createDeviceProfile, publishDeviceProfile } from './platform/deviceProfile.js';
import { installGameSurfaceInputGuard } from './platform/gameSurfaceInput.js';
import { createRuntimePerformanceBenchmark } from './game/services/RuntimePerformanceBenchmark.js';

const gameShell = document.getElementById('game-shell');
installGameSurfaceInputGuard(gameShell);

const platformServices = createPlatformServices();
const deviceProfile = publishDeviceProfile(createDeviceProfile({ platformServices }));
const useExtendedTabletStage = deviceProfile.layout.extendedTabletStage;
const useWidePhoneStage = deviceProfile.layout.wideStage;
const useCompactPhoneUi = deviceProfile.layout.compactPhoneUi;

// Android/iOS packages are deliberate app launches rather than incidental web
// visits. Their native WebView is configured for media autoplay, so unlock the
// shared audio service immediately while keeping browser playback gesture-gated.
if (platformServices.native) arcadeAudio.unlock();

// Dynamic resolution-specific menu loading is intentionally asynchronous.
// Keep diagnostics callable during that very short import window so test and
// accessibility clients can wait for Boot/Splash without racing an undefined
// bridge.
window.render_game_to_text = () => JSON.stringify({ mode: 'boot-loading' });
window.advanceTime = () => {};

const loadMenuScenes = async () => {
  if (useCompactPhoneUi) return import('./game/compact/index.js');
  const [
    { IntroScene },
    { CustomizeScene },
    { SettingsScene },
    { PowerLabScene },
    { MiniGamesScene },
    { MiniGameSetupScene },
  ] = await Promise.all([
    import('./game/scenes/IntroScene.js'),
    import('./game/scenes/CustomizeScene.js'),
    import('./game/scenes/SettingsScene.js'),
    import('./game/scenes/PowerLabScene.js'),
    import('./game/scenes/MiniGamesScene.js'),
    import('./game/scenes/MiniGameSetupScene.js'),
  ]);
  return { IntroScene, CustomizeScene, SettingsScene, PowerLabScene, MiniGamesScene, MiniGameSetupScene };
};

const startGame = async () => {
  const {
    IntroScene,
    CustomizeScene,
    SettingsScene,
    PowerLabScene,
    MiniGamesScene,
    MiniGameSetupScene,
  } = await loadMenuScenes();

  const config = {
  type: Phaser.CANVAS,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#07101f',
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: useExtendedTabletStage || useWidePhoneStage ? Phaser.Scale.EXPAND : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: 'game-shell',
  },
  input: {
    activePointers: 6,
    keyboard: true,
    touch: {
      // The shell guard cancels only cancelable touchstart/touchmove defaults.
      // Keep Phaser capture off because its touchcancel path calls
      // preventDefault even when Android marks the lifecycle event noncancelable.
      capture: false,
    },
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1.08 },
      enableSleeping: false,
      debug: false,
    },
  },
  scene: [
    BootScene,
    SplashScene,
    IntroScene,
    CustomizeScene,
    SettingsScene,
    PowerLabScene,
    MiniGamesScene,
    MiniGameSetupScene,
    MiniGameLoadingScene,
    MatchLoadingScene,
    MatchScene,
  ],
  };

  const game = new Phaser.Game(config);
  game.registry.set('compactPhoneUi', useCompactPhoneUi);
  game.registry.set('deviceProfile', deviceProfile);
  const runtimePerformanceBenchmark = createRuntimePerformanceBenchmark({
  game,
  renderer: config.type === Phaser.CANVAS ? 'canvas' : 'webgl',
});
const fullscreenAdapter = {
  isFullscreen: () => game.scale.isFullscreen,
  enter: () => game.scale.startFullscreen(),
  exit: () => game.scale.stopFullscreen(),
};
const platformActions = Object.freeze({
  toggleFullscreen: () => platformServices.toggleFullscreen(fullscreenAdapter),
  getAppInfo: () => platformServices.getAppInfo(),
  getInstallState: () => platformServices.getInstallState(),
  installWebApp: () => platformServices.installWebApp(),
  openExternalUrl: (url) => platformServices.openExternalUrl(url),
  lockLandscape: () => platformServices.lockLandscape(),
  getDeviceProfile: () => deviceProfile,
});
game.registry.set('platformActions', platformActions);

const getActiveScene = () => game.scene.getScenes(true).at(-1) ?? null;
let pendingScaleRefresh = 0;
const refreshGameScale = () => {
  cancelAnimationFrame(pendingScaleRefresh);
  pendingScaleRefresh = requestAnimationFrame(() => {
    game.scale.refresh();
    pendingScaleRefresh = requestAnimationFrame(() => game.scale.refresh());
  });
};
platformServices.on(PLATFORM_EVENTS.activeChange, ({ isActive }) => {
  arcadeAudio.setPageVisible(isActive);
  if (isActive) refreshGameScale();
  getActiveScene()?.handlePlatformActiveChange?.(isActive);
});
platformServices.on(PLATFORM_EVENTS.backButton, () => {
  const handled = getActiveScene()?.handlePlatformBack?.() === true;
  if (!handled) platformServices.minimizeApp();
});
game.events.on('platform:haptic', (style) => platformServices.haptic(style));
platformServices.initialize().then(refreshGameScale).catch(() => {});

window.render_game_to_text = renderActiveState;
window.advanceTime = (milliseconds) => advanceActiveScene(Math.max(0, Number(milliseconds) || 0));
window.__SKYHEAD_GAME__ = game;
window.__SKYHEAD_PERFORMANCE__ = runtimePerformanceBenchmark;
window.__SKYHEAD_AUDIO_DEBUG__ = {
  diagnostics: () => arcadeAudio.diagnostics(),
  warmAll: () => arcadeAudio.warmAll(),
};
window.__SKYHEAD_PLATFORM_DEBUG__ = {
  diagnostics: () => ({
    ...platformServices.diagnostics(),
    extendedTabletStage: useExtendedTabletStage,
    widePhoneStage: useWidePhoneStage,
    compactPhoneUi: useCompactPhoneUi,
    deviceProfile,
  }),
  setActiveForTesting: (isActive) => platformServices.emit(PLATFORM_EVENTS.activeChange, { isActive }),
  backForTesting: () => platformServices.emit(PLATFORM_EVENTS.backButton),
  openExternalUrlForTesting: (url) => platformServices.openExternalUrl(url),
};

const unlockAudio = () => arcadeAudio.unlock();
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
window.addEventListener('resize', refreshGameScale);
window.addEventListener('orientationchange', refreshGameScale);
window.addEventListener('pagehide', () => {
  window.removeEventListener('resize', refreshGameScale);
  window.removeEventListener('orientationchange', refreshGameScale);
  platformServices.destroy();
}, { once: true });

  window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
  if (event.key.toLowerCase() !== 'f') return;
  if (event.repeat) return;
  platformActions.toggleFullscreen();
  });
};

startGame().catch((error) => {
  console.error('Unable to start Joel Football', error);
});
