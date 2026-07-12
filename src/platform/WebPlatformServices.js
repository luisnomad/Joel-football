import { PLATFORM_EVENTS, PlatformServices } from './PlatformServices.js';
import { createWebAppInfo } from '../appMetadata.js';

export class WebPlatformServices extends PlatformServices {
  constructor({ documentRef = globalThis.document, screenRef = globalThis.screen, navigatorRef = globalThis.navigator } = {}) {
    super({ platform: 'web', native: false });
    this.documentRef = documentRef;
    this.screenRef = screenRef;
    this.navigatorRef = navigatorRef;
    this.deferredInstallPrompt = null;
    this.installCompleted = false;
    this.onVisibilityChange = () => {
      this.emit(PLATFORM_EVENTS.activeChange, { isActive: !this.documentRef?.hidden });
    };
    this.onBeforeInstallPrompt = (event) => {
      event.preventDefault?.();
      this.deferredInstallPrompt = event;
    };
    this.onAppInstalled = () => {
      this.installCompleted = true;
      this.deferredInstallPrompt = null;
    };
  }

  async initialize() {
    this.documentRef?.addEventListener?.('visibilitychange', this.onVisibilityChange);
    globalThis.addEventListener?.('beforeinstallprompt', this.onBeforeInstallPrompt);
    globalThis.addEventListener?.('appinstalled', this.onAppInstalled);
    this.registerServiceWorker();
    this.onVisibilityChange();
  }

  async destroy() {
    this.documentRef?.removeEventListener?.('visibilitychange', this.onVisibilityChange);
    globalThis.removeEventListener?.('beforeinstallprompt', this.onBeforeInstallPrompt);
    globalThis.removeEventListener?.('appinstalled', this.onAppInstalled);
    await super.destroy();
  }

  async lockLandscape() {
    try {
      await this.screenRef?.orientation?.lock?.('landscape');
    } catch {
      // Most browsers only allow orientation locking after entering fullscreen.
    }
  }

  async toggleFullscreen(adapter = {}) {
    if (adapter.isFullscreen?.()) {
      await adapter.exit?.();
      this.immersive = false;
      return;
    }
    await adapter.enter?.();
    this.immersive = true;
    await this.lockLandscape();
  }

  async haptic(style = 'light') {
    const duration = style === 'heavy' ? 35 : style === 'medium' ? 22 : 12;
    this.navigatorRef?.vibrate?.(duration);
  }

  async getAppInfo() {
    return createWebAppInfo();
  }

  isInstalled() {
    return this.installCompleted
      || globalThis.matchMedia?.('(display-mode: standalone)')?.matches
      || this.navigatorRef?.standalone === true;
  }

  isMobileDevice() {
    const userAgent = this.navigatorRef?.userAgent ?? '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
      || ((this.navigatorRef?.maxTouchPoints ?? 0) > 0 && (this.screenRef?.width ?? 9999) < 1400);
  }

  getInstallState() {
    if (this.isInstalled()) return { available: false, installed: true, method: 'installed' };
    if (this.deferredInstallPrompt) return { available: true, installed: false, method: 'prompt' };
    if (this.isMobileDevice()) return { available: true, installed: false, method: 'instructions' };
    return { available: false, installed: false, method: 'unavailable' };
  }

  async installWebApp() {
    const state = this.getInstallState();
    if (state.method !== 'prompt') return state;
    const prompt = this.deferredInstallPrompt;
    this.deferredInstallPrompt = null;
    await prompt.prompt?.();
    const choice = await prompt.userChoice?.catch?.(() => null);
    return { ...this.getInstallState(), outcome: choice?.outcome ?? 'dismissed' };
  }

  registerServiceWorker() {
    if (!this.navigatorRef?.serviceWorker || !globalThis.isSecureContext) return;
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
    this.navigatorRef.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL }).catch(() => {});
  }
}
