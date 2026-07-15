import { PLATFORM_EVENTS, PlatformServices } from './PlatformServices.js';
import { createWebAppInfo } from '../appMetadata.js';

export class WebPlatformServices extends PlatformServices {
  constructor({
    documentRef = globalThis.document,
    screenRef = globalThis.screen,
    navigatorRef = globalThis.navigator,
    locationRef = globalThis.location,
    secureContext = globalThis.isSecureContext,
    development = import.meta.env.DEV,
  } = {}) {
    super({ platform: 'web', native: false });
    this.documentRef = documentRef;
    this.screenRef = screenRef;
    this.navigatorRef = navigatorRef;
    this.locationRef = locationRef;
    this.secureContext = secureContext;
    this.development = development;
    this.deferredInstallPrompt = null;
    this.installCompleted = false;
    this.onVisibilityChange = () => {
      this.emit(PLATFORM_EVENTS.activeChange, { isActive: !this.documentRef?.hidden });
    };
    this.onBeforeInstallPrompt = (event) => {
      if (this.development) return;
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
    if (!this.development) {
      globalThis.addEventListener?.('beforeinstallprompt', this.onBeforeInstallPrompt);
      globalThis.addEventListener?.('appinstalled', this.onAppInstalled);
    }
    await this.registerServiceWorker();
    this.onVisibilityChange();
  }

  async destroy() {
    this.documentRef?.removeEventListener?.('visibilitychange', this.onVisibilityChange);
    if (!this.development) {
      globalThis.removeEventListener?.('beforeinstallprompt', this.onBeforeInstallPrompt);
      globalThis.removeEventListener?.('appinstalled', this.onAppInstalled);
    }
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

  async registerServiceWorker() {
    const serviceWorker = this.navigatorRef?.serviceWorker;
    if (!serviceWorker || !this.secureContext) return;

    if (this.development) {
      const registrations = await serviceWorker.getRegistrations?.().catch?.(() => []) ?? [];
      const scope = this.locationRef?.href ? new URL(import.meta.env.BASE_URL, this.locationRef.href).href : null;
      const appRegistrations = registrations.filter((registration) => !scope || !registration.scope || registration.scope === scope);
      const removed = await Promise.all(appRegistrations.map((registration) => registration.unregister().catch(() => false)));
      if (serviceWorker.controller && removed.some(Boolean)) this.locationRef?.reload?.();
      return;
    }

    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
    await serviceWorker.register(`${serviceWorkerUrl}?v=3`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).catch(() => {});
  }
}
