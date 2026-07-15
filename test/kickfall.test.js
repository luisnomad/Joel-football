import { describe, expect, it } from 'vitest';
import {
  KICKFALL_CONFIG,
  KICKFALL_LEVELS,
  auditKickfallCampaign,
  createKickfallPauseLayout,
  createKickfallResultLayout,
  createKickfallLandingGuides,
  createKickfallTiers,
  getKickfallLevel,
  getKickfallGateHealth,
  createKickfallProgress,
  isArmedGateHit,
  isKickfallKickContact,
  resolveKickfallChargeTransfer,
  resolveKickfallBossCounterWave,
  resolveKickfallMagnetPull,
  resolveKickfallVerticalIntent,
  resolveKickfallOutcome,
  stepKickfallFallVelocity,
  stepKickfallJumpBuffer,
  stepKickfallRunCycle,
} from '../src/game/minigames/kickfall/kickfallRules.js';
import {
  DEFAULT_KICKFALL_THEME_ID,
  KICKFALL_THEMES,
  getKickfallTheme,
  getKickfallThemeAssets,
} from '../src/game/minigames/kickfall/kickfallThemes.js';

describe('Kickfall rules', () => {
  it('keeps compact pause and result actions inside their modal cards', () => {
    const assertContained = ({ panel, elements }) => {
      const panelLeft = panel.x - panel.width / 2;
      const panelRight = panel.x + panel.width / 2;
      const panelTop = panel.y - panel.height / 2;
      const panelBottom = panel.y + panel.height / 2;
      elements.forEach(({ x, y, width, height }) => {
        expect(x - width / 2).toBeGreaterThanOrEqual(panelLeft);
        expect(x + width / 2).toBeLessThanOrEqual(panelRight);
        expect(y - height / 2).toBeGreaterThanOrEqual(panelTop);
        expect(y + height / 2).toBeLessThanOrEqual(panelBottom);
      });
    };

    const pause = createKickfallPauseLayout();
    expect(pause.title.fontSize).toBeLessThanOrEqual(44);
    expect(pause.copy.wrapWidth).toBeLessThan(pause.panel.width);
    expect(pause.buttons.map(({ id }) => id)).toEqual(['resume', 'restart', 'leave']);
    assertContained({ panel: pause.panel, elements: pause.buttons });

    const defeat = createKickfallResultLayout({ victory: false, hasNext: true });
    expect(defeat.panel).toMatchObject({ width: 720, height: 390 });
    expect(defeat.title.fontSize).toBeLessThanOrEqual(48);
    expect(defeat.copy.wrapWidth).toBeLessThan(defeat.panel.width);
    expect(defeat.buttons.map(({ id }) => id)).toEqual(['retry', 'menu']);
    expect(new Set(defeat.buttons.map(({ y }) => y)).size).toBe(1);
    assertContained({ panel: defeat.panel, elements: defeat.buttons });

    const nextLevel = createKickfallResultLayout({ victory: true, hasNext: true });
    expect(nextLevel.buttons.map(({ id }) => id)).toEqual(['retry', 'continue', 'menu']);
    expect(new Set(nextLevel.buttons.map(({ y }) => y)).size).toBe(1);
    assertContained({ panel: nextLevel.panel, elements: nextLevel.buttons });
  });

  it('defines swappable visual themes without duplicating gameplay geometry', () => {
    expect(DEFAULT_KICKFALL_THEME_ID).toBe('cosmic');
    expect(Object.keys(KICKFALL_THEMES)).toEqual(['cosmic', 'workshop']);

    const cosmic = getKickfallTheme('cosmic');
    expect(cosmic).toMatchObject({
      id: 'cosmic',
      textureKeys: {
        backdrop: 'kickfall-cosmic-backdrop',
        milkyWay: 'kickfall-cosmic-milky-way',
        moon: 'kickfall-cosmic-moon',
        platform: 'kickfall-cosmic-platform',
        gate: 'kickfall-cosmic-gate',
        catchRail: 'kickfall-cosmic-catch',
        cleat: 'kickfall-cosmic-cleat',
      },
      motion: {
        milkyWayCycleSeconds: 180,
        moonTravelSeconds: 90,
      },
    });
    expect(cosmic).not.toHaveProperty('tiers');
    expect(cosmic).not.toHaveProperty('collisionGeometry');
    expect(getKickfallTheme('not-a-theme')).toBe(cosmic);
  });

  it('returns only the selected theme assets for lazy scene loading', () => {
    const assets = getKickfallThemeAssets('cosmic');
    expect(assets.map(({ key }) => key)).toEqual([
      'kickfall-cosmic-backdrop',
      'kickfall-cosmic-milky-way',
      'kickfall-cosmic-moon',
      'kickfall-cosmic-platform',
      'kickfall-cosmic-gate',
      'kickfall-cosmic-catch',
      'kickfall-cosmic-cleat',
    ]);
    expect(assets.every(({ asset }) => asset.startsWith('themes/cosmic/'))).toBe(true);
    expect(new Set(assets.map(({ key }) => key)).size).toBe(assets.length);
    expect(getKickfallThemeAssets('workshop').every(({ key }) => !key.includes('cosmic'))).toBe(true);
  });

  it('uses the clock instead of a narrow spawn-column danger defeat', () => {
    expect(KICKFALL_CONFIG).not.toHaveProperty('dangerGraceSeconds');
    expect(KICKFALL_CONFIG).not.toHaveProperty('dangerLineY');
    expect(getKickfallLevel(1).timerSeconds).toBe(90);
    expect(resolveKickfallOutcome({
      spawned: 8,
      quota: 8,
      drained: 0,
      activeBalls: 8,
      dangerSeconds: 999,
      timeRemaining: 40,
    })).toBe(null);
  });

  it('allows only a live armed window to damage a gate once', () => {
    expect(isArmedGateHit({
      armedUntil: 3,
      now: 2.5,
      gateId: 'gate-a',
      damagedGateIds: [],
    })).toBe(true);
    expect(isArmedGateHit({
      armedUntil: 3,
      now: 3,
      gateId: 'gate-a',
      damagedGateIds: [],
    })).toBe(false);
    expect(isArmedGateHit({
      armedUntil: 3,
      now: 2.5,
      gateId: 'gate-a',
      damagedGateIds: ['gate-a'],
    })).toBe(false);
  });

  it('requires the forward foot strike to overlap the ball', () => {
    const shared = {
      playerX: 100,
      playerY: 100,
      facing: 1,
      ballY: 122,
      ballRadius: 18,
      footForwardOffset: 30,
      footVerticalOffset: 24,
      footRadius: 12,
    };

    expect(isKickfallKickContact({ ...shared, ballX: 186 })).toBe(false);
    expect(isKickfallKickContact({ ...shared, ballX: 152 })).toBe(true);
    expect(isKickfallKickContact({ ...shared, facing: -1, ballX: 48 })).toBe(true);
    expect(isKickfallKickContact({ ...shared, facing: -1, ballX: 14 })).toBe(false);
  });

  it('attenuates one live kick charge as it passes through a touching ball queue', () => {
    const transfer = resolveKickfallChargeTransfer({
      sourceX: 900,
      sourceY: 320,
      sourceVx: -12,
      sourceArmedUntil: 5,
      sourceImpactPower: 1,
      targetX: 862,
      targetY: 321,
      targetVx: 0,
      targetArmedUntil: 0,
      now: 4.5,
    });

    expect(transfer).toMatchObject({
      direction: -1,
      sourceArmedUntil: 0,
      sourceImpactPower: 0,
      targetArmedUntil: 5,
      targetImpactPower: 0.9,
    });
    expect(transfer.targetVelocityX).toBeCloseTo(-10.08);
    expect(resolveKickfallChargeTransfer({
      sourceX: 900,
      sourceY: 320,
      sourceVx: -12,
      sourceArmedUntil: 5,
      targetX: 820,
      targetY: 320,
      now: 4.5,
    })).toBe(null);

    let impactPower = 1;
    for (let hop = 0; hop < 6; hop += 1) {
      impactPower = resolveKickfallChargeTransfer({
        sourceX: 900 - hop * 38,
        sourceY: 320,
        sourceVx: -12,
        sourceArmedUntil: 5,
        sourceImpactPower: impactPower,
        targetX: 862 - hop * 38,
        targetY: 320,
        now: 4.5,
      }).targetImpactPower;
    }
    expect(impactPower).toBeCloseTo(0.9 ** 6);
    expect(impactPower).toBeGreaterThan(0.5);
    expect(impactPower).toBeLessThan(1);
  });

  it('advances the run cycle at a readable time-based cadence', () => {
    expect(stepKickfallRunCycle({
      cycle: 0,
      dt: 1 / 60,
      speed: 12.5,
    })).toBeCloseTo(0.15);
    expect(stepKickfallRunCycle({
      cycle: 2,
      dt: 0.1,
      speed: 0,
    })).toBe(2);
    expect(stepKickfallRunCycle({
      cycle: 2,
      dt: 0.1,
      speed: 6.25,
    })).toBeCloseTo(2.75);
  });

  it('requires the full quota to drain before victory', () => {
    expect(resolveKickfallOutcome({ spawned: 8, quota: 8, drained: 7, activeBalls: 1 })).toBe(null);
    expect(resolveKickfallOutcome({ spawned: 8, quota: 8, drained: 8, activeBalls: 0 })).toBe('victory');
  });

  it('defines a timed second level with both obstacle types', () => {
    const level = getKickfallLevel(2);

    expect(level.ballQuota).toBe(10);
    expect(level.timerSeconds).toBe(60);
    expect(level.obstacles.map(({ type }) => type)).toEqual(['pocket', 'cleat']);
    expect(getKickfallLevel(99)).toBe(KICKFALL_LEVELS[19]);
  });

  it('authors twenty escalating levels with manual, uphill, reinforced, and boss milestones', () => {
    expect(KICKFALL_LEVELS).toHaveLength(20);
    expect(getKickfallLevel(3).tierModes).toContain('flat');
    expect(getKickfallLevel(6).tierModes).toContain('uphill');
    expect(getKickfallGateHealth(getKickfallLevel(5), 'gate-b')).toBe(2);
    expect(getKickfallLevel(10).boss).toMatchObject({ hits: 3 });
    expect(getKickfallLevel(20).boss).toMatchObject({ hits: 5 });
    expect(getKickfallLevel(20).ballQuota).toBeGreaterThan(getKickfallLevel(1).ballQuota);
    expect(getKickfallLevel(20).spawnIntervalSeconds).toBeLessThan(getKickfallLevel(1).spawnIntervalSeconds);
  });

  it('sends a touching ball queue backward as a boss counter-shot wave', () => {
    const wave = resolveKickfallBossCounterWave({
      targetId: 1,
      balls: [
        { id: 1, x: 509, radius: 18 },
        { id: 2, x: 547, radius: 18 },
        { id: 3, x: 585, radius: 18 },
        { id: 4, x: 760, radius: 18 },
      ],
      direction: 1,
      kickSpeed: 14.5,
    });

    expect(wave.map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(wave.every(({ velocityX }) => velocityX >= 12)).toBe(true);
    expect(wave.map(({ velocityX }) => velocityX)).toEqual([...wave]
      .map(({ velocityX }) => velocityX).sort((a, b) => b - a));
    expect(wave.every(({ suppressAssistSeconds }) => suppressAssistSeconds >= 0.8)).toBe(true);
  });

  it('turns lane modes into downhill assist, flat manual play, and opposing slopes', () => {
    const tiers = createKickfallTiers({ tierModes: ['downhill', 'flat', 'uphill', 'downhill'] });
    expect(tiers.map(({ mode }) => mode)).toEqual(['downhill', 'flat', 'uphill', 'downhill']);
    expect(tiers[0]).toMatchObject({ flow: 1, rollAssist: 1 });
    expect(tiers[0].angle).toBeGreaterThan(0);
    expect(tiers[1]).toMatchObject({ flow: -1, angle: 0, rollAssist: 0 });
    expect(tiers[2]).toMatchObject({ flow: 1, rollAssist: -0.48 });
    expect(tiers[2].angle).toBeLessThan(0);
  });

  it('adds mirrored receiving wedges to every non-top lane that can return a ball to its entry wall', () => {
    const tiers = createKickfallTiers({ tierModes: ['downhill', 'flat', 'flat', 'uphill'] });
    const guides = createKickfallLandingGuides(tiers);

    expect(guides).toHaveLength(3);
    expect(guides.map(({ tierId }) => tierId)).toEqual(['upper', 'lower', 'bottom']);
    expect(guides[0]).toMatchObject({
      id: 'flat-entry-upper',
      flow: -1,
      width: 168,
      height: 54,
      assistSpeed: 4.2,
    });
    expect(guides[0].entryX).toBeGreaterThan(guides[0].exitX);
    expect(guides[0].angle).toBeLessThan(0);
    expect(guides[0].dropX).toBe(1120);
    expect(guides[1].entryX).toBeLessThan(guides[1].exitX);
    expect(guides[1].angle).toBeGreaterThan(0);
    expect(guides[1].dropX).toBe(160);
    expect(155 - guides[0].height).toBeGreaterThan(82);
    expect(Math.abs(guides[0].angle)).toBeGreaterThan(0.3);
    expect(Math.abs(guides[0].exitX - guides[0].entryX)).toBe(168);
    expect(Math.abs(guides[1].exitX - guides[1].entryX)).toBe(168);
    expect(guides[2]).toMatchObject({
      id: 'uphill-entry-bottom',
      flow: -1,
      width: 168,
      assistSpeed: 4.2,
    });
  });

  it('audits every authored stage as a complete reachable route', () => {
    const audits = auditKickfallCampaign();

    expect(audits.map(({ levelNumber }) => levelNumber)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(audits.map(({ valid }) => valid)).toEqual(Array(20).fill(true));
    expect(audits.flatMap(({ issues }) => issues)).toEqual([]);
    audits.forEach((audit) => {
      expect(audit.finishWindowSeconds).toBeGreaterThanOrEqual(30);
      expect(audit.gates.every(({ approachClear, orderedAfterEntry, exitClear }) => (
        approachClear && orderedAfterEntry && exitClear
      ))).toBe(true);
      expect(audit.obstacles.every(({ approachClear, orderedAfterGate, exitClear }) => (
        approachClear && orderedAfterGate && exitClear
      ))).toBe(true);
      expect(audit.tiers.every(({ requiresReceiver, receiverClear }) => (
        !requiresReceiver || receiverClear
      ))).toBe(true);
      expect(audit.boss === null || audit.boss.approachClear).toBe(true);
    });

    expect(audits.find(({ levelNumber }) => levelNumber === 7).tiers
      .find(({ tierId }) => tierId === 'upper')).toMatchObject({
      mode: 'uphill',
      requiresReceiver: true,
      receiverClear: true,
      guideId: 'uphill-entry-upper',
    });
  });

  it('pulls a pocket ball through a visible magnetic arc before holding it', () => {
    const shared = {
      startX: 538,
      startY: 320,
      targetX: 490,
      targetY: 322,
      duration: 0.32,
      arcHeight: 10,
    };

    expect(resolveKickfallMagnetPull({ ...shared, elapsed: 0 })).toMatchObject({
      x: 538,
      y: 320,
      progress: 0,
      complete: false,
    });
    const halfway = resolveKickfallMagnetPull({ ...shared, elapsed: 0.16 });
    expect(halfway.progress).toBe(0.5);
    expect(halfway.x).toBeGreaterThan(shared.targetX);
    expect(halfway.x).toBeLessThan(shared.startX);
    expect(halfway.y).toBeLessThan((shared.startY + shared.targetY) / 2);
    expect(halfway.scale).toBeLessThan(1);
    expect(halfway.complete).toBe(false);
    expect(resolveKickfallMagnetPull({ ...shared, elapsed: 0.32 })).toMatchObject({
      x: 490,
      y: 322,
      progress: 1,
      scale: 1,
      complete: true,
    });
  });

  it('ends a timed level when its clock reaches zero', () => {
    expect(resolveKickfallOutcome({ timeRemaining: 0 })).toBe('defeat');
    expect(resolveKickfallOutcome({ timeRemaining: 0.01 })).toBe(null);
  });

  it('requires jump plus a vertical direction to request a lane transfer', () => {
    expect(resolveKickfallVerticalIntent({ downHeld: true })).toEqual({
      tierDirection: 0,
      jump: false,
    });
    expect(resolveKickfallVerticalIntent({ jumpPressed: true, downHeld: true })).toEqual({
      tierDirection: 1,
      jump: false,
    });
    expect(resolveKickfallVerticalIntent({ jumpPressed: true, upHeld: true })).toEqual({
      tierDirection: -1,
      jump: false,
    });
    expect(resolveKickfallVerticalIntent({ jumpPressed: true })).toEqual({
      tierDirection: 0,
      jump: true,
    });
  });

  it('accelerates a falling player decisively instead of gliding at terminal speed', () => {
    expect(stepKickfallFallVelocity({ velocityY: 2 })).toBe(2.5);
    expect(stepKickfallFallVelocity({ velocityY: 14.9 })).toBe(15);
  });

  it('buffers a jump long enough to survive a just-before-landing key press', () => {
    expect(stepKickfallJumpBuffer({ seconds: 0, jumpPressed: true, dt: 1 / 60 })).toBe(0.14);
    expect(stepKickfallJumpBuffer({ seconds: 0.14, jumpPressed: false, dt: 0.05 })).toBeCloseTo(0.09);
    expect(stepKickfallJumpBuffer({ seconds: 0.02, jumpPressed: false, dt: 0.05 })).toBe(0);
  });

  it('allows a clear regardless of the removed danger counters', () => {
    expect(resolveKickfallOutcome({
      spawned: 8,
      quota: 8,
      drained: 8,
      activeBalls: 0,
      dangerSeconds: 999,
    })).toBe('victory');
  });

  it('requires a boss to be defeated before a boss level can clear', () => {
    const clearedBalls = { spawned: 10, quota: 10, drained: 10, activeBalls: 0 };
    expect(resolveKickfallOutcome({ ...clearedBalls, bossRequired: true, bossDefeated: false })).toBe(null);
    expect(resolveKickfallOutcome({ ...clearedBalls, bossRequired: true, bossDefeated: true })).toBe('victory');
  });

  it('creates isolated progress records', () => {
    const first = createKickfallProgress();
    const second = createKickfallProgress({ spawned: 2 });
    first.drained = 1;

    expect(second).toEqual({
      spawned: 2,
      drained: 0,
      gatesBroken: 0,
      obstacleClears: 0,
    });
  });
});
