import { Capacitor, SystemBars } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { PLATFORM_EVENTS, PlatformServices } from './PlatformServices.js';

const ignorePluginFailure = (operation) => Promise.resolve(operation).catch(() => {});

export class CapacitorPlatformServices extends PlatformServices {
  constructor({
    app = App,
    haptics = Haptics,
    screenOrientation = ScreenOrientation,
    systemBars = SystemBars,
    platform = Capacitor.getPlatform(),
  } = {}) {
    super({ platform, native: true });
    this.app = app;
    this.hapticsPlugin = haptics;
    this.screenOrientation = screenOrientation;
    this.systemBars = systemBars;
    this.listenerHandles = [];
  }

  async initialize() {
    this.immersive = true;
    await Promise.all([
      this.lockLandscape(),
      ignorePluginFailure(this.systemBars.hide()),
    ]);

    const [activeHandle, backHandle] = await Promise.all([
      this.app.addListener('appStateChange', ({ isActive }) => {
        if (isActive && this.immersive) ignorePluginFailure(this.systemBars.hide());
        this.emit(PLATFORM_EVENTS.activeChange, { isActive: Boolean(isActive) });
      }),
      this.app.addListener('backButton', () => this.emit(PLATFORM_EVENTS.backButton)),
    ]);
    this.listenerHandles.push(activeHandle, backHandle);

    const state = await this.app.getState?.().catch?.(() => null);
    if (state) this.emit(PLATFORM_EVENTS.activeChange, { isActive: Boolean(state.isActive) });
  }

  async destroy() {
    await Promise.all(this.listenerHandles.map((handle) => ignorePluginFailure(handle?.remove?.())));
    this.listenerHandles = [];
    await super.destroy();
  }

  async lockLandscape() {
    await ignorePluginFailure(this.screenOrientation.lock({ orientation: 'landscape' }));
  }

  async toggleFullscreen() {
    this.immersive = !this.immersive;
    if (this.immersive) {
      await Promise.all([
        ignorePluginFailure(this.systemBars.hide()),
        this.lockLandscape(),
      ]);
    } else {
      await ignorePluginFailure(this.systemBars.show());
    }
  }

  async haptic(style = 'light') {
    if (['success', 'warning', 'error'].includes(style)) {
      await ignorePluginFailure(this.hapticsPlugin.notification({ type: style.toUpperCase() }));
      return;
    }
    const impactStyle = style === 'heavy' ? 'HEAVY' : style === 'medium' ? 'MEDIUM' : 'LIGHT';
    await ignorePluginFailure(this.hapticsPlugin.impact({ style: impactStyle }));
  }

  async minimizeApp() {
    await ignorePluginFailure(this.app.minimizeApp());
  }

  async getAppInfo() {
    try {
      const info = await this.app.getInfo();
      return {
        name: info.name,
        version: info.version,
        build: info.build,
        id: info.id,
      };
    } catch {
      return null;
    }
  }
}
