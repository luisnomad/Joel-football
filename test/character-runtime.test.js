import { describe, expect, it } from 'vitest';
import {
  getFootballCollisionGeometry,
  getKickfallCollisionGeometry,
} from '../src/game/content/characterCollisionProfiles.js';
import {
  getCharacter,
  normalizeCharacterId,
} from '../src/game/content/characters.js';
import {
  getSpriteSourcePointWorldPosition,
  syncCharacterVisual,
} from '../src/game/entities/CharacterVisualRig.js';
import {
  MAX_SIMULATION_FRAME_SECONDS,
  clampSimulationFrameDelta,
} from '../src/game/pure/fixedStep.js';
import { createForwardStrikeCapsule } from '../src/game/pure/gameplayPhysics.js';
import {
  estimateTextureResidency,
  summarizeFrameTimes,
} from '../src/game/services/RuntimePerformanceBenchmark.js';

const createFakeSprite = ({
  x = 0,
  y = 0,
  displayOriginX = 160,
  displayOriginY = 318,
  scaleX = 0.5,
  scaleY = 0.5,
  frame = 0,
  bodyBottom = 636,
} = {}) => ({
  x,
  y,
  width: 320,
  height: 480,
  displayOriginX,
  displayOriginY,
  scaleX,
  scaleY,
  angle: 0,
  flipX: false,
  frame: { name: frame },
  body: { bounds: { max: { y: bodyBottom } } },
  setFrame(next) {
    this.frame = { name: next };
    return this;
  },
  setFlipX(next) {
    this.flipX = next;
    return this;
  },
  setScale(nextX, nextY) {
    this.scaleX = nextX;
    this.scaleY = nextY;
    return this;
  },
  setAngle(next) {
    this.angle = next;
    return this;
  },
  setPosition(nextX, nextY) {
    this.x = nextX;
    this.y = nextY;
    return this;
  },
});

describe('explicit character collision profiles', () => {
  it('keeps visual scale independent from gameplay geometry', () => {
    expect(getFootballCollisionGeometry({ visualScale: 1.2 })).toMatchObject({
      bodyScale: 1,
      headCapY: -76,
    });
    expect(getKickfallCollisionGeometry({ visualScale: 1.2 })).toMatchObject({
      bodyWidth: 44,
      bodyHeight: 82,
      footForwardOffset: 30,
    });
  });

  it('declares Dad and Mum as intentionally larger in both games', () => {
    const dad = getCharacter('dad');
    const mum = getCharacter('mum');
    expect(getFootballCollisionGeometry(dad)).toMatchObject({
      bodyScale: 1.2,
      headTop: 284,
    });
    expect(getFootballCollisionGeometry(mum)).toMatchObject({
      bodyScale: 1.2,
      headTop: 266,
    });
    const dadKickfall = getKickfallCollisionGeometry(dad);
    expect(dadKickfall.bodyWidth).toBeCloseTo(52.8);
    expect(dadKickfall.bodyHeight).toBeCloseTo(98.4);
    expect(dadKickfall.footForwardOffset).toBeCloseTo(36);
    expect(dadKickfall.footVerticalOffset).toBeCloseTo(28.8);
    expect(dadKickfall.footRadius).toBeCloseTo(9.6);
  });

  it('migrates the retired Vex identity to canonical Bob', () => {
    expect(normalizeCharacterId('vex')).toBe('bob');
    expect(getCharacter('vex').id).toBe('bob');
    expect(getCharacter('bob').sheetTexture).toBe('bob-sheet');
  });
});

describe('shared character visual rig', () => {
  it('pins the authored foot through scale, flip, and rotation', () => {
    const physics = createFakeSprite({ x: 400, y: 585, bodyBottom: 636, frame: 10 });
    physics.flipX = true;
    const visual = createFakeSprite();

    syncCharacterVisual({
      physicsSprite: physics,
      visualSprite: visual,
      scaleX: 0.62,
      scaleY: 0.57,
      angle: 7,
      sourceAnchorY: 418,
    });

    expect(visual.frame.name).toBe(10);
    expect(visual.flipX).toBe(true);
    const foot = getSpriteSourcePointWorldPosition(visual, 160, 418);
    expect(foot.x).toBeCloseTo(400, 8);
    expect(foot.y).toBeCloseTo(636, 8);
  });
});

describe('shared strike and fixed-step contracts', () => {
  it('creates mirrored forward strike capsules', () => {
    expect(createForwardStrikeCapsule({
      x: 100,
      y: 200,
      facing: -1,
      startForwardOffset: 5,
      endForwardOffset: 40,
      verticalOffset: 12,
      radius: 8,
    })).toEqual({
      start: { x: 95, y: 212 },
      end: { x: 60, y: 212 },
      capsuleRadius: 8,
    });
  });

  it('preserves ordinary stalls while bounding inactive-tab gaps', () => {
    expect(clampSimulationFrameDelta(100)).toBe(0.1);
    expect(clampSimulationFrameDelta(1000)).toBe(MAX_SIMULATION_FRAME_SECONDS);
    expect(clampSimulationFrameDelta(-10)).toBe(0);
  });
});

describe('opt-in runtime benchmark reporting', () => {
  it('reports frame percentiles and long-frame counts', () => {
    expect(summarizeFrameTimes([16, 16, 17, 20, 40])).toMatchObject({
      samples: 5,
      medianFrameMs: 17,
      p95FrameMs: 40,
      p99FrameMs: 40,
      medianFps: 58.8,
      refreshIntervalMs: 17,
      missedRefreshThresholdMs: 25.5,
      framesWithMissedRefresh: 1,
      estimatedMissedRefreshes: 1,
      framesOver33_3ms: 1,
    });
  });

  it('reports an honest empty benchmark instead of an artificial FPS value', () => {
    expect(summarizeFrameTimes([])).toMatchObject({
      samples: 0,
      medianFps: 0,
      refreshIntervalMs: 0,
      framesWithMissedRefresh: 0,
      estimatedMissedRefreshes: 0,
    });
  });

  it('estimates decoded texture dimensions without treating file size as memory', () => {
    const textures = {
      fighter: { source: [{ width: 1280, height: 1440 }] },
      portrait: { source: [{ width: 512, height: 512 }] },
    };
    const residency = estimateTextureResidency({
      getTextureKeys: () => ['__DEFAULT', 'fighter', 'portrait'],
      get: (key) => textures[key],
    });
    expect(residency.textures).toBe(2);
    expect(residency.estimatedDecodedMiB).toBeCloseTo(8.03, 1);
    expect(residency.largest[0].key).toBe('fighter');
  });
});
