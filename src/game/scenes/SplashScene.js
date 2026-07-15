import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';

const MAX_SPLASH_MS = 5_000;
const MIN_SPLASH_MS = 3_000;
const ASSET_READY_SETTLE_MS = 180;
const FADE_TO_WHITE_MS = 420;
const FADE_FROM_WHITE_MS = 460;

export class SplashScene extends Phaser.Scene {
  constructor() {
    super('Splash');
  }

  create() {
    this.language = playerProfileStore.get().language;
    this.transitionStarted = false;
    this.transitionReason = 'pending';
    this.requiredAssetsReady = true;
    this.testAdvancedMs = 0;
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      clearTimeout(this.maxTimer);
      clearTimeout(this.assetReadyTimer);
    });

    this.scheduleAutomaticTransition();
  }

  scheduleAutomaticTransition() {
    const startedAt = Number(window.__JOEL_SPLASH_STARTED_AT__) || performance.now();
    const elapsed = performance.now() - startedAt;
    const remainingUntilCap = Math.max(0, MAX_SPLASH_MS - elapsed);
    const remainingUntilMinimum = Math.max(0, MIN_SPLASH_MS - elapsed);
    this.maxTimer = setTimeout(() => this.beginTransition('five-second-cap'), remainingUntilCap);

    // BootScene only starts Splash after the required Phaser texture cache is ready.
    this.assetReadyTimer = setTimeout(
      () => this.beginTransition('required-assets-ready'),
      Math.max(ASSET_READY_SETTLE_MS, remainingUntilMinimum),
    );
  }

  beginTransition(reason) {
    if (this.transitionStarted) return;
    this.transitionStarted = true;
    this.transitionReason = reason;
    clearTimeout(this.maxTimer);
    clearTimeout(this.assetReadyTimer);

    const overlay = document.getElementById('startup-splash');
    if (!overlay) {
      this.scene.start('Intro');
      return;
    }

    overlay.dataset.transitionReason = reason;
    overlay.classList.add('is-fading-to-white');
    setTimeout(() => {
      this.scene.start('Intro');
      requestAnimationFrame(() => {
        overlay.classList.add('is-revealing-menu');
        setTimeout(() => overlay.remove(), FADE_FROM_WHITE_MS + 80);
      });
    }, FADE_TO_WHITE_MS);
  }

  serializeState() {
    return {
      mode: 'splash',
      title: 'Joel Football',
      language: this.language,
      selectedArtwork: 'option-a',
      requiredAssetsReady: this.requiredAssetsReady,
      autoAdvance: true,
      minDisplayMs: MIN_SPLASH_MS,
      maxDisplayMs: MAX_SPLASH_MS,
      transitionReason: this.transitionReason,
      visibleOverlayText: '',
      spinnerPosition: 'bottom-right',
      coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720',
      actions: [],
    };
  }

  advanceForTesting(milliseconds = 0) {
    this.testAdvancedMs += Math.max(0, Number(milliseconds) || 0);
    const startedAt = Number(window.__JOEL_SPLASH_STARTED_AT__) || performance.now();
    const effectiveElapsed = performance.now() - startedAt + this.testAdvancedMs;
    if (!this.transitionStarted && effectiveElapsed >= MIN_SPLASH_MS) {
      this.beginTransition('test-time-advance');
    }
    this.game.renderer.preRender();
    this.sys.render(this.game.renderer);
    this.game.renderer.postRender();
  }
}
