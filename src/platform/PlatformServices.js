export const PLATFORM_EVENTS = Object.freeze({
  activeChange: 'active-change',
  backButton: 'back-button',
});

export class PlatformServices {
  constructor({ platform = 'web', native = false } = {}) {
    this.platform = platform;
    this.native = native;
    this.immersive = false;
    this.listeners = new Map();
  }

  on(eventName, listener) {
    const listeners = this.listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(eventName);
    };
  }

  emit(eventName, payload) {
    [...(this.listeners.get(eventName) ?? [])].forEach((listener) => listener(payload));
  }

  diagnostics() {
    return {
      platform: this.platform,
      native: this.native,
      immersive: this.immersive,
    };
  }

  async initialize() {}

  async destroy() {
    this.listeners.clear();
  }

  async lockLandscape() {}

  async toggleFullscreen() {}

  async haptic() {}

  async minimizeApp() {}

  async getAppInfo() {
    return null;
  }

  getInstallState() {
    return { available: false, installed: this.native, method: this.native ? 'native' : 'unavailable' };
  }

  async installWebApp() {
    return this.getInstallState();
  }
}
