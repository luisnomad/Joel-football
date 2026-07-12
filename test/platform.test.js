import { describe, expect, it, vi } from 'vitest';
import { PLATFORM_EVENTS } from '../src/platform/PlatformServices.js';
import { WebPlatformServices } from '../src/platform/WebPlatformServices.js';
import { CapacitorPlatformServices } from '../src/platform/CapacitorPlatformServices.js';

describe('WebPlatformServices', () => {
  it('maps page visibility, fullscreen, orientation, and vibration to the shared contract', async () => {
    const documentListeners = new Map();
    const documentRef = {
      hidden: false,
      addEventListener: vi.fn((name, listener) => documentListeners.set(name, listener)),
      removeEventListener: vi.fn((name) => documentListeners.delete(name)),
    };
    const screenRef = { orientation: { lock: vi.fn(async () => {}) } };
    const navigatorRef = { vibrate: vi.fn() };
    const service = new WebPlatformServices({ documentRef, screenRef, navigatorRef });
    const activeStates = [];
    service.on(PLATFORM_EVENTS.activeChange, ({ isActive }) => activeStates.push(isActive));

    await service.initialize();
    documentRef.hidden = true;
    documentListeners.get('visibilitychange')();
    expect(activeStates).toEqual([true, false]);

    const adapter = {
      fullscreen: false,
      isFullscreen() { return this.fullscreen; },
      enter: vi.fn(async function enter() { adapter.fullscreen = true; }),
      exit: vi.fn(async function exit() { adapter.fullscreen = false; }),
    };
    await service.toggleFullscreen(adapter);
    expect(screenRef.orientation.lock).toHaveBeenCalledWith('landscape');
    expect(service.diagnostics().immersive).toBe(true);
    await service.toggleFullscreen(adapter);
    expect(adapter.exit).toHaveBeenCalledOnce();

    await service.haptic('medium');
    expect(navigatorRef.vibrate).toHaveBeenCalledWith(22);
    expect(await service.getAppInfo()).toMatchObject({ name: 'Joel Football', version: '1.0.0', build: 'web' });
    await service.destroy();
    expect(documentRef.removeEventListener).toHaveBeenCalledWith('visibilitychange', service.onVisibilityChange);
  });

  it('offers native install prompts when available and iOS-style instructions otherwise', async () => {
    const mobileService = new WebPlatformServices({
      documentRef: {},
      screenRef: { width: 844 },
      navigatorRef: { maxTouchPoints: 1, userAgent: 'Mobile Safari' },
    });
    expect(mobileService.getInstallState()).toEqual({ available: true, installed: false, method: 'instructions' });

    const prompt = vi.fn(async () => {});
    mobileService.onBeforeInstallPrompt({
      preventDefault: vi.fn(),
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    expect(mobileService.getInstallState().method).toBe('prompt');
    expect(await mobileService.installWebApp()).toMatchObject({ outcome: 'accepted' });
    expect(prompt).toHaveBeenCalledOnce();
  });
});

describe('CapacitorPlatformServices', () => {
  it('owns native lifecycle, Back, landscape, immersive mode, haptics, and listener cleanup', async () => {
    const callbacks = new Map();
    const remove = vi.fn(async () => {});
    const app = {
      addListener: vi.fn(async (name, callback) => {
        callbacks.set(name, callback);
        return { remove };
      }),
      getState: vi.fn(async () => ({ isActive: true })),
      getInfo: vi.fn(async () => ({ name: 'Joel Football', version: '1.0.0', build: '7', id: 'com.example.joel' })),
      minimizeApp: vi.fn(async () => {}),
    };
    const screenOrientation = { lock: vi.fn(async () => {}) };
    const systemBars = { hide: vi.fn(async () => {}), show: vi.fn(async () => {}) };
    const haptics = {
      impact: vi.fn(async () => {}),
      notification: vi.fn(async () => {}),
    };
    const service = new CapacitorPlatformServices({ app, screenOrientation, systemBars, haptics, platform: 'android' });
    const activeStates = [];
    let backs = 0;
    service.on(PLATFORM_EVENTS.activeChange, ({ isActive }) => activeStates.push(isActive));
    service.on(PLATFORM_EVENTS.backButton, () => { backs += 1; });

    await service.initialize();
    expect(screenOrientation.lock).toHaveBeenCalledWith({ orientation: 'landscape' });
    expect(systemBars.hide).toHaveBeenCalled();
    expect(activeStates).toEqual([true]);

    callbacks.get('appStateChange')({ isActive: false });
    callbacks.get('backButton')();
    expect(activeStates).toEqual([true, false]);
    expect(backs).toBe(1);

    await service.toggleFullscreen();
    expect(systemBars.show).toHaveBeenCalledOnce();
    await service.toggleFullscreen();
    expect(systemBars.hide).toHaveBeenCalledTimes(2);
    await service.haptic('heavy');
    await service.haptic('success');
    expect(haptics.impact).toHaveBeenCalledWith({ style: 'HEAVY' });
    expect(haptics.notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
    await service.minimizeApp();
    expect(app.minimizeApp).toHaveBeenCalledOnce();
    expect(await service.getAppInfo()).toEqual({
      name: 'Joel Football',
      version: '1.0.0',
      build: '7',
      id: 'com.example.joel',
    });

    await service.destroy();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
