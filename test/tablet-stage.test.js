import { describe, expect, it } from 'vitest';
import {
  BASE_STAGE_ASPECT,
  createStageLayout,
  getWideStageUiScale,
  shouldExpandWidePhoneStage,
  shouldUseCompactPhoneUi,
  shouldExtendTabletStage,
} from '../src/game/layout/tabletStage.js';

describe('non-16:9 tablet stage', () => {
  it('extends touch tablets with shorter landscape aspect ratios', () => {
    expect(BASE_STAGE_ASPECT).toBeCloseTo(16 / 9);
    expect(shouldExtendTabletStage({
      viewportWidth: 1280,
      viewportHeight: 800,
      coarsePointer: true,
      touchPoints: 5,
    })).toBe(true);
    expect(shouldExtendTabletStage({
      viewportWidth: 1024,
      viewportHeight: 768,
      touchPoints: 5,
    })).toBe(true);
  });

  it('limits compact menus to phone-class wide touch displays', () => {
    expect(shouldUseCompactPhoneUi({
      viewportWidth: 924,
      viewportHeight: 412,
      touchPoints: 5,
      mobileUserAgent: true,
    })).toBe(true);
    expect(shouldUseCompactPhoneUi({
      viewportWidth: 732,
      viewportHeight: 412,
      touchPoints: 5,
      mobileUserAgent: true,
    })).toBe(true);
    expect(shouldUseCompactPhoneUi({
      viewportWidth: 1920,
      viewportHeight: 800,
      touchPoints: 5,
      mobileUserAgent: false,
    })).toBe(false);
    expect(shouldUseCompactPhoneUi({
      viewportWidth: 1280,
      viewportHeight: 800,
      touchPoints: 5,
      mobileUserAgent: false,
    })).toBe(false);
    expect(shouldUseCompactPhoneUi({
      viewportWidth: 924,
      viewportHeight: 412,
      touchPoints: 0,
      coarsePointer: false,
      mobileUserAgent: true,
    })).toBe(false);
  });

  it('preserves 16:9, phones, portrait devices, and non-touch desktop layouts', () => {
    expect(shouldExtendTabletStage({ viewportWidth: 1280, viewportHeight: 720, touchPoints: 5 })).toBe(false);
    expect(shouldExtendTabletStage({ viewportWidth: 844, viewportHeight: 390, touchPoints: 5 })).toBe(false);
    expect(shouldExtendTabletStage({ viewportWidth: 800, viewportHeight: 1280, touchPoints: 5 })).toBe(false);
    expect(shouldExtendTabletStage({ viewportWidth: 1280, viewportHeight: 800 })).toBe(false);
  });

  it('evaluates the eventual landscape dimensions when a native activity starts in portrait', () => {
    expect(shouldExtendTabletStage({
      viewportWidth: 800,
      viewportHeight: 1280,
      touchPoints: 5,
      forceLandscape: true,
    })).toBe(true);
    expect(shouldExtendTabletStage({
      viewportWidth: 720,
      viewportHeight: 1280,
      touchPoints: 5,
      forceLandscape: true,
    })).toBe(false);
  });

  it('keeps the gameplay region fixed and reports only the added bottom band', () => {
    expect(createStageLayout({ width: 1280, height: 800 })).toEqual({
      extended: true,
      width: 1280,
      height: 800,
      gameplayWidth: 1280,
      gameplayHeight: 720,
      extraHeight: 80,
      bottomOffset: 80,
    });
    expect(createStageLayout({ width: 1280, height: 720 }).extended).toBe(false);
  });

  it('expands extra-wide landscape touch devices without changing regular tablets or desktop', () => {
    expect(shouldExpandWidePhoneStage({
      viewportWidth: 1179,
      viewportHeight: 590,
      touchPoints: 5,
    })).toBe(true);
    expect(shouldExpandWidePhoneStage({
      viewportWidth: 844,
      viewportHeight: 390,
      coarsePointer: true,
    })).toBe(true);
    expect(shouldExpandWidePhoneStage({ viewportWidth: 1280, viewportHeight: 720, touchPoints: 5 })).toBe(false);
    expect(shouldExpandWidePhoneStage({
      viewportWidth: 1920,
      viewportHeight: 800,
      touchPoints: 5,
    })).toBe(true);
    expect(shouldExpandWidePhoneStage({ viewportWidth: 1280, viewportHeight: 800, touchPoints: 5 })).toBe(false);
    expect(shouldExpandWidePhoneStage({ viewportWidth: 1280, viewportHeight: 590 })).toBe(false);
    expect(shouldExpandWidePhoneStage({ viewportWidth: 590, viewportHeight: 1179, touchPoints: 5 })).toBe(false);
  });

  it('recognizes a wide phone from its eventual landscape shape during a portrait startup race', () => {
    expect(shouldExpandWidePhoneStage({
      viewportWidth: 430,
      viewportHeight: 932,
      touchPoints: 5,
      forceLandscape: true,
    })).toBe(true);
    expect(shouldExpandWidePhoneStage({
      viewportWidth: 412,
      viewportHeight: 924,
      coarsePointer: true,
      forceLandscape: true,
    })).toBe(true);
    expect(shouldExpandWidePhoneStage({
      viewportWidth: 800,
      viewportHeight: 1280,
      touchPoints: 5,
      forceLandscape: true,
    })).toBe(false);
  });

  it('modestly enlarges UI on horizontally expanded stages', () => {
    expect(getWideStageUiScale(createStageLayout({ width: 1280, height: 720 }))).toBe(1);
    expect(getWideStageUiScale(createStageLayout({ width: 1439, height: 720 }))).toBeCloseTo(1.12);
    expect(getWideStageUiScale(createStageLayout({ width: 1600, height: 720 }))).toBe(1.12);
  });
});
