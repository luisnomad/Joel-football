import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants.js';
import { advanceActiveScene, renderActiveState } from './game/stateBridge.js';
import { BootScene } from './game/scenes/BootScene.js';
import { IntroScene } from './game/scenes/IntroScene.js';
import { MatchScene } from './game/scenes/MatchScene.js';
import { PowerLabScene } from './game/scenes/PowerLabScene.js';
import { SettingsScene } from './game/scenes/SettingsScene.js';
import { arcadeAudio } from './game/services/ArcadeAudio.js';

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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: 'game-shell',
  },
  input: {
    activePointers: 6,
    keyboard: true,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1.08 },
      enableSleeping: false,
      debug: false,
    },
  },
  scene: [BootScene, IntroScene, SettingsScene, PowerLabScene, MatchScene],
};

const game = new Phaser.Game(config);

window.render_game_to_text = renderActiveState;
window.advanceTime = (milliseconds) => advanceActiveScene(Math.max(0, Number(milliseconds) || 0));
window.__SKYHEAD_GAME__ = game;
window.__SKYHEAD_AUDIO_DEBUG__ = {
  diagnostics: () => arcadeAudio.diagnostics(),
  warmAll: () => arcadeAudio.warmAll(),
};

const unlockAudio = () => arcadeAudio.unlock();
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
document.addEventListener('visibilitychange', () => arcadeAudio.setPageVisible(!document.hidden));

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
  if (event.key.toLowerCase() !== 'f') return;
  if (game.scale.isFullscreen) game.scale.stopFullscreen();
  else game.scale.startFullscreen();
});
