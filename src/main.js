import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants.js';
import { advanceActiveScene, renderActiveState } from './game/stateBridge.js';
import { BootScene } from './game/scenes/BootScene.js';
import { IntroScene } from './game/scenes/IntroScene.js';
import { MatchScene } from './game/scenes/MatchScene.js';
import { PowerLabScene } from './game/scenes/PowerLabScene.js';
import { SettingsScene } from './game/scenes/SettingsScene.js';
import { SplashScene } from './game/scenes/SplashScene.js';
import { arcadeAudio } from './game/services/ArcadeAudio.js';
import { detectExtendedTabletStage, detectWidePhoneStage } from './game/layout/tabletStage.js';
import { PLATFORM_EVENTS } from './platform/PlatformServices.js';
import { createPlatformServices } from './platform/createPlatformServices.js';

const platformServices = createPlatformServices();
const useExtendedTabletStage = detectExtendedTabletStage({ forceLandscape: platformServices.native });
const useWidePhoneStage = detectWidePhoneStage();

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
      // CSS `touch-action: none` owns gesture suppression. Avoid calling
      // preventDefault on Android touchcancel events that are not cancelable.
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
  scene: [BootScene, SplashScene, IntroScene, SettingsScene, PowerLabScene, MatchScene],
};

const game = new Phaser.Game(config);
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
window.__SKYHEAD_AUDIO_DEBUG__ = {
  diagnostics: () => arcadeAudio.diagnostics(),
  warmAll: () => arcadeAudio.warmAll(),
};
window.__SKYHEAD_PLATFORM_DEBUG__ = {
  diagnostics: () => ({
    ...platformServices.diagnostics(),
    extendedTabletStage: useExtendedTabletStage,
    widePhoneStage: useWidePhoneStage,
  }),
  setActiveForTesting: (isActive) => platformServices.emit(PLATFORM_EVENTS.activeChange, { isActive }),
  backForTesting: () => platformServices.emit(PLATFORM_EVENTS.backButton),
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
