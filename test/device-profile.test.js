import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeviceProfile } from '../src/platform/deviceProfile.js';

const stubNativeBoot = ({ screenWidth, screenHeight, devicePixelRatio = 1 }) => {
  vi.stubGlobal('devicePixelRatio', devicePixelRatio);
  vi.stubGlobal('innerWidth', 1);
  vi.stubGlobal('innerHeight', 1);
  vi.stubGlobal('visualViewport', { width: 1, height: 1 });
  vi.stubGlobal('screen', {
    width: screenWidth,
    height: screenHeight,
    availWidth: screenWidth,
    availHeight: screenHeight,
  });
  vi.stubGlobal('navigator', {
    maxTouchPoints: 5,
    userAgent: 'Android Mobile',
    userAgentData: { mobile: true },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
};

describe('native device profile bootstrap', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the stable screen when the native WebView still reports 1x1', () => {
    stubNativeBoot({ screenWidth: 412, screenHeight: 924, devicePixelRatio: 2.625 });

    const profile = createDeviceProfile({
      platformServices: { native: true, platform: 'android' },
    });

    expect(profile.viewport).toMatchObject({ width: 924, height: 412 });
    expect(profile.formFactor).toBe('phone');
    expect(profile.resourceProfile).toBe('compact-phone');
    expect(profile.layout.compactPhoneUi).toBe(true);
  });

  it('uses compact menus on a conventional 16:9 native phone', () => {
    stubNativeBoot({ screenWidth: 732, screenHeight: 412, devicePixelRatio: 2.625 });

    const profile = createDeviceProfile({
      platformServices: { native: true, platform: 'android' },
    });

    expect(profile.viewport).toMatchObject({ width: 732, height: 412 });
    expect(profile.formFactor).toBe('phone');
    expect(profile.resourceProfile).toBe('compact-phone');
    expect(profile.layout).toMatchObject({ compactPhoneUi: true, wideStage: false });
  });

  it('does not turn a tablet into a compact phone during the same boot race', () => {
    stubNativeBoot({ screenWidth: 1280, screenHeight: 800, devicePixelRatio: 1 });

    const profile = createDeviceProfile({
      platformServices: { native: true, platform: 'android' },
    });

    expect(profile.viewport).toMatchObject({ width: 1280, height: 800 });
    expect(profile.formFactor).toBe('tablet');
    expect(profile.resourceProfile).toBe('tablet');
    expect(profile.layout.compactPhoneUi).toBe(false);
  });
});
