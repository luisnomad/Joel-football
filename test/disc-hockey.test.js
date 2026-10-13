import { describe, expect, it } from 'vitest';
import { getDiscHockeyCollisionMap } from '../src/game/minigames/discHockey/discHockeyCollisionMaps.js';
import {
  DISC_HOCKEY_AI,
  DISC_HOCKEY_ARENA,
  DISC_HOCKEY_CRAZY_AI,
  DISC_HOCKEY_CRAZY_POWER,
  DISC_HOCKEY_CRAZY_ROLES,
  DISC_HOCKEY_CREASE_RULE,
  DISC_HOCKEY_HUMAN_CONTROL,
  DISC_HOCKEY_IMPACT_AUDIO,
  DISC_HOCKEY_MATCH_SECONDS,
  DISC_HOCKEY_PUCK_SURFACE,
  DISC_HOCKEY_STALL_REFLEX,
  addDiscHockeyCrazyPower,
  chooseDiscHockeyCrazyTargets,
  chooseDiscHockeyAiTarget,
  chooseDiscHockeyAiGuardTarget,
  clampDiscPlayerPosition,
  closestPointOnCollisionContour,
  constrainDiscToCollisionMap,
  createDiscHockeyCornerBankPuck,
  createDiscHockeyCrazyAttackPuck,
  createDiscHockeyPoweredPuck,
  createDiscHockeyStallReflexPuck,
  detectDiscHockeyGoal,
  evaluateDiscHockeyCrease,
  formatDiscHockeyTime,
  getDiscHockeyAiGuardX,
  getDiscHockeyAiTuning,
  getDiscHockeyCrazyRoleMotion,
  getDiscHockeyEjectionVelocity,
  getDiscHockeyHumanMotion,
  getDiscHockeyImpactVolume,
  getDiscHockeyIntentionalHit,
  getDiscHockeyMatchResult,
  getDiscHockeyPoweredKnockback,
  isDiscHockeyDefensiveSave,
  isDiscHockeyGoalThreat,
  predictDiscHockeyPuckY,
  moveDiscDirectlyTowardTarget,
  moveDiscTowardTarget,
  releaseDiscHockeyControl,
  resolveDiscHockeyGoalCharacterId,
  resolvePlayerPuckCollision,
  selectDiscHockeyCrazyRoster,
  separateDiscHockeyPushers,
  shouldDiscHockeyAiEndRecovery,
  shouldEndDiscHockeyPoweredShot,
  stepPuck,
} from '../src/game/minigames/discHockey/discHockeyRules.js';
import {
  DISC_HOCKEY_COLLISION_MAPS,
} from '../src/game/minigames/discHockey/discHockeyCollisionMaps.js';
import {
  createDefaultProfile,
  sanitizeProfile,
  setDiscHockeySettings,
  setGameDifficulty,
} from '../src/game/pure/profile.js';
import { getMiniGameEntry, MINI_GAME_IDS } from '../src/game/minigames/minigameCatalog.js';

const playerSpawnFixture = (side, x, y) => ({
  side,
  x,
  y,
  vx: 0,
  vy: 0,
  radius: DISC_HOCKEY_ARENA.playerRadius,
});

describe('Disc Hockey profile and lazy catalog', () => {
  it('keeps independent valid setup choices and sanitizes corrupt values', () => {
    const defaults = createDefaultProfile();
    expect(defaults.discHockey).toEqual({ mode: 'computer', themeId: 'ice' });
    expect(defaults.difficultyByGame.discHockey).toBe('normal');

    const configured = setDiscHockeySettings(
      setGameDifficulty(defaults, 'discHockey', 'hard'),
      { mode: 'local', themeId: 'neon' },
    );
    expect(configured.discHockey).toEqual({ mode: 'local', themeId: 'neon' });
    expect(configured.difficultyByGame.discHockey).toBe('hard');
    expect(sanitizeProfile({
      discHockey: { mode: 'online', themeId: 'pink' },
      difficultyByGame: { discHockey: 'impossible' },
    }).discHockey).toEqual({ mode: 'computer', themeId: 'ice' });
    expect(setDiscHockeySettings(defaults, { mode: 'crazy' }).discHockey).toEqual({
      mode: 'crazy',
      themeId: 'ice',
    });
  });

  it('exposes both mini-games through dynamic loader functions', () => {
    expect(MINI_GAME_IDS).toEqual(['kickfall', 'discHockey']);
    expect(getMiniGameEntry('kickfall')).toMatchObject({ sceneKey: 'Kickfall' });
    expect(getMiniGameEntry('discHockey')).toMatchObject({ sceneKey: 'DiscHockey' });
    expect(getMiniGameEntry('discHockey').load).toBeTypeOf('function');
  });
});

describe('Disc Hockey pure gameplay', () => {
  it('gives direct touch tracking much faster response than keyboard movement', () => {
    const disc = {
      x: 250,
      y: DISC_HOCKEY_ARENA.centerY,
      vx: 0,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.playerRadius,
      side: 'left',
    };
    const target = { x: 540, y: DISC_HOCKEY_ARENA.centerY };
    const keyboard = moveDiscTowardTarget({
      disc,
      target,
      deltaSeconds: 1 / 60,
      maxSpeed: DISC_HOCKEY_HUMAN_CONTROL.keyboardMaxSpeed,
      side: 'left',
    });
    const touch = moveDiscTowardTarget({
      disc,
      target,
      deltaSeconds: 1 / 60,
      maxSpeed: DISC_HOCKEY_HUMAN_CONTROL.touchMaxSpeed,
      response: DISC_HOCKEY_HUMAN_CONTROL.touchResponse,
      side: 'left',
    });

    expect(DISC_HOCKEY_HUMAN_CONTROL).toMatchObject({
      touchMaxSpeed: 2400,
      touchResponse: 200,
    });
    expect(touch.x - disc.x).toBeGreaterThan((keyboard.x - disc.x) * 5);
    expect(touch.vx).toBeGreaterThan(keyboard.vx * 5);
  });

  it('follows a finger directly without overshooting or wobbling back', () => {
    let disc = {
      x: 405,
      y: DISC_HOCKEY_ARENA.centerY,
      vx: 0,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.playerRadius,
      side: 'left',
    };
    const target = { x: 200, y: DISC_HOCKEY_ARENA.centerY };
    for (let frame = 0; frame < 6; frame += 1) {
      disc = moveDiscDirectlyTowardTarget({
        disc,
        target,
        deltaSeconds: 1 / 60,
        maxSpeed: DISC_HOCKEY_HUMAN_CONTROL.touchMaxSpeed,
        side: 'left',
      });
      expect(disc.x).toBeGreaterThanOrEqual(target.x);
    }
    expect(disc.x).toBeCloseTo(target.x, 5);
    disc = moveDiscDirectlyTowardTarget({
      disc,
      target,
      deltaSeconds: 1 / 60,
      maxSpeed: DISC_HOCKEY_HUMAN_CONTROL.touchMaxSpeed,
      side: 'left',
    });
    expect(disc.x).toBeCloseTo(target.x, 5);
    expect(disc.vx).toBe(0);
  });

  it('uses a pusher collider exactly 10% larger than the original disc', () => {
    expect(DISC_HOCKEY_ARENA.playerRadius).toBeCloseTo(44 * 1.1, 5);
  });

  it('runs fixed three-minute matches and resolves wins, losses, and draws', () => {
    expect(DISC_HOCKEY_MATCH_SECONDS).toBe(180);
    expect(formatDiscHockeyTime(180)).toBe('3:00');
    expect(formatDiscHockeyTime(179)).toBe('2:59');
    expect(formatDiscHockeyTime(0.01)).toBe('0:01');
    expect(formatDiscHockeyTime(0)).toBe('0:00');
    expect(getDiscHockeyMatchResult({ left: 8, right: 3 })).toBe('left');
    expect(getDiscHockeyMatchResult({ left: 2, right: 7 })).toBe('right');
    expect(getDiscHockeyMatchResult({ left: 4, right: 4 })).toBe('draw');
  });

  it('attributes normal goals by side and Crazy goals to the actual squad puck toucher', () => {
    expect(resolveDiscHockeyGoalCharacterId({
      scoringSide: 'left',
      leftCharacterId: 'joel',
      rightCharacterId: 'lucia',
    })).toBe('joel');
    expect(resolveDiscHockeyGoalCharacterId({
      scoringSide: 'right',
      leftCharacterId: 'lucia',
      rightCharacterId: 'joel',
    })).toBe('joel');
    expect(resolveDiscHockeyGoalCharacterId({
      scoringSide: 'right',
      leftCharacterId: 'lucia',
      rightCharacterId: 'bob',
      isCrazyMode: true,
      lastPuckTouch: { side: 'right', characterId: 'joel' },
    })).toBe('joel');
    expect(resolveDiscHockeyGoalCharacterId({
      scoringSide: 'right',
      leftCharacterId: 'joel',
      rightCharacterId: 'bob',
      isCrazyMode: true,
      lastPuckTouch: { side: 'left', characterId: 'joel' },
    })).toBeNull();
  });

  it('uses one identical touch motion profile for both local players', () => {
    const playerOneMotion = getDiscHockeyHumanMotion(true);
    const playerTwoMotion = getDiscHockeyHumanMotion(true);
    expect(playerOneMotion).toEqual(playerTwoMotion);
    expect(playerOneMotion).toEqual({
      maxSpeed: DISC_HOCKEY_HUMAN_CONTROL.touchMaxSpeed,
      response: DISC_HOCKEY_HUMAN_CONTROL.touchResponse,
      direct: true,
    });
  });

  it('stops all residual motion when touch or mouse control is released', () => {
    const controlled = {
      side: 'left',
      x: 150,
      y: 383,
      vx: 940,
      vy: -180,
      target: { x: 150, y: 383 },
      pointerId: 77,
    };
    expect(releaseDiscHockeyControl(controlled)).toEqual({
      ...controlled,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
    });
    expect(controlled).toMatchObject({
      vx: 940,
      vy: -180,
      pointerId: 77,
    });
  });

  it('strictly clamps each player to their rink half', () => {
    const left = clampDiscPlayerPosition({ side: 'left', x: 900, y: 20 });
    const right = clampDiscPlayerPosition({ side: 'right', x: 200, y: 900 });
    expect(left.x).toBeCloseTo(
      DISC_HOCKEY_ARENA.centerX - DISC_HOCKEY_ARENA.playerRadius,
      5,
    );
    expect(right.x).toBeCloseTo(
      DISC_HOCKEY_ARENA.centerX + DISC_HOCKEY_ARENA.playerRadius,
      5,
    );
    expect(closestPointOnCollisionContour({
      ...left,
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    }).distance).toBeCloseTo(DISC_HOCKEY_ARENA.playerRadius, 5);
    expect(closestPointOnCollisionContour({
      ...right,
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    }).distance).toBeCloseTo(DISC_HOCKEY_ARENA.playerRadius, 5);
  });

  it('uses separate invisible contours traced from the Ice and Neon artwork', () => {
    expect(DISC_HOCKEY_COLLISION_MAPS.ice.visible).toBe(false);
    expect(DISC_HOCKEY_COLLISION_MAPS.neon.visible).toBe(false);
    expect(DISC_HOCKEY_COLLISION_MAPS.ice.goalVisible).toBe(false);
    expect(DISC_HOCKEY_COLLISION_MAPS.neon.goalVisible).toBe(false);
    expect(DISC_HOCKEY_COLLISION_MAPS.ice.bounds).not.toEqual(
      DISC_HOCKEY_COLLISION_MAPS.neon.bounds,
    );
    expect(DISC_HOCKEY_COLLISION_MAPS.ice.goalLineLeft).not.toBe(
      DISC_HOCKEY_COLLISION_MAPS.neon.goalLineLeft,
    );
    expect(DISC_HOCKEY_COLLISION_MAPS.ice).toMatchObject({
      id: 'ice-inner-wall-v2',
      goalLineLeft: 104,
      goalLineRight: 1176,
      goalTop: 258,
      goalBottom: 455,
    });

    Object.values(DISC_HOCKEY_COLLISION_MAPS).forEach((collisionMap) => {
      const puck = constrainDiscToCollisionMap({
        x: 0,
        y: 0,
        radius: DISC_HOCKEY_ARENA.puckRadius,
        collisionMap,
      });
      const wall = closestPointOnCollisionContour({
        ...puck,
        collisionMap,
      });
      expect(wall.inside).toBe(true);
      expect(wall.distance).toBeCloseTo(DISC_HOCKEY_ARENA.puckRadius, 5);

      [DISC_HOCKEY_ARENA.puckRadius, DISC_HOCKEY_ARENA.playerRadius].forEach((radius) => {
        for (let y = 40; y <= 680; y += 80) {
          for (let x = 40; x <= 1240; x += 100) {
            const mapped = constrainDiscToCollisionMap({
              x,
              y,
              radius,
              collisionMap,
            });
            const sampledWall = closestPointOnCollisionContour({
              ...mapped,
              collisionMap,
            });
            expect(sampledWall.inside).toBe(true);
            expect(sampledWall.distance).toBeGreaterThanOrEqual(radius - 0.01);
          }
        }
      });
    });
  });

  it('accelerates toward a legal target without teleporting across midfield', () => {
    const moved = moveDiscTowardTarget({
      disc: { x: 300, y: 350, vx: 0, vy: 0, radius: 44 },
      target: { x: 1000, y: 350 },
      side: 'left',
      deltaSeconds: 1 / 60,
    });
    expect(moved.x).toBeGreaterThan(300);
    expect(moved.x).toBeLessThan(DISC_HOCKEY_ARENA.centerX - 44);
    expect(moved.vx).toBeGreaterThan(0);
  });

  it('pushes an overlapping puck and ignores separated circles', () => {
    const player = { side: 'left', x: 300, y: 300, vx: 240, vy: 0, radius: 44 };
    const puck = { x: 360, y: 300, vx: 0, vy: 0, radius: 25 };
    const hit = resolvePlayerPuckCollision({ player, puck });
    expect(hit.collided).toBe(true);
    expect(hit.impactSpeed).toBe(240);
    expect(hit.puck.x).toBeGreaterThan(puck.x);
    expect(hit.puck.vx).toBeGreaterThan(player.vx);
    expect(resolvePlayerPuckCollision({
      player,
      puck: { ...puck, x: 500 },
    })).toMatchObject({ collided: false, impactSpeed: 0 });
  });

  it('scales Hockey contact audio from half volume to full volume by impact speed', () => {
    expect(DISC_HOCKEY_IMPACT_AUDIO).toEqual({
      minimumVolumeScale: 0.5,
      fullVolumeSpeed: 900,
    });
    expect(getDiscHockeyImpactVolume(-100)).toBe(0.5);
    expect(getDiscHockeyImpactVolume(0)).toBe(0.5);
    expect(getDiscHockeyImpactVolume(450)).toBe(0.75);
    expect(getDiscHockeyImpactVolume(900)).toBe(1);
    expect(getDiscHockeyImpactVolume(1800)).toBe(1);
  });

  it('warns and penalizes symmetric goal camping without punishing active defense', () => {
    expect(DISC_HOCKEY_CREASE_RULE).toEqual({
      warningSeconds: 1,
      violationSeconds: 4,
      penaltySeconds: 1.25,
      extraCreaseDepth: 36,
      puckSafetyDepth: 300,
      boundaryHysteresis: 8,
      ejectionSeconds: 0.5,
      ejectionPushSeconds: 0.32,
      ejectionSpeed: 650,
      maximumEjectionAngleDegrees: 24,
    });
    const collisionMap = DISC_HOCKEY_COLLISION_MAPS.ice;
    const leftCamper = {
      side: 'left',
      x: collisionMap.goalLineLeft + DISC_HOCKEY_ARENA.playerRadius,
      y: (collisionMap.goalTop + collisionMap.goalBottom) / 2,
      radius: DISC_HOCKEY_ARENA.playerRadius,
    };
    const safePuck = {
      x: DISC_HOCKEY_ARENA.centerX,
      y: DISC_HOCKEY_ARENA.centerY,
    };
    expect(evaluateDiscHockeyCrease({
      player: leftCamper,
      puck: safePuck,
      previousSeconds: 0.99,
      deltaSeconds: 0,
      collisionMap,
    })).toMatchObject({
      inCrease: true,
      puckThreatening: false,
      camping: true,
      warning: false,
      violated: false,
    });
    expect(evaluateDiscHockeyCrease({
      player: leftCamper,
      puck: safePuck,
      previousSeconds: 0.99,
      deltaSeconds: 0.02,
      collisionMap,
    })).toMatchObject({ warning: true, violated: false });
    expect(evaluateDiscHockeyCrease({
      player: leftCamper,
      puck: safePuck,
      previousSeconds: 3.99,
      deltaSeconds: 0.02,
      collisionMap,
    })).toMatchObject({ violated: true, seconds: 0 });
    expect(evaluateDiscHockeyCrease({
      player: leftCamper,
      puck: { ...safePuck, x: collisionMap.goalLineLeft + 200 },
      previousSeconds: 2.9,
      deltaSeconds: 0.2,
      collisionMap,
    })).toMatchObject({
      inCrease: true,
      puckThreatening: true,
      camping: false,
      warning: false,
      violated: false,
      seconds: 0,
    });
    const rightCamper = {
      ...leftCamper,
      side: 'right',
      x: collisionMap.goalLineRight - DISC_HOCKEY_ARENA.playerRadius,
    };
    expect(evaluateDiscHockeyCrease({
      player: rightCamper,
      puck: safePuck,
      previousSeconds: 2,
      deltaSeconds: 0,
      collisionMap,
    })).toMatchObject({
      side: 'right',
      inCrease: true,
      camping: true,
      warning: true,
    });

    const upperLipCamper = {
      ...leftCamper,
      y: collisionMap.goalTop - leftCamper.radius / 2,
    };
    expect(evaluateDiscHockeyCrease({
      player: upperLipCamper,
      puck: safePuck,
      previousSeconds: 0,
      deltaSeconds: 0.1,
      collisionMap,
    })).toMatchObject({
      inCrease: true,
      camping: true,
      seconds: 0.1,
    });

    const creaseEdge = collisionMap.goalLineLeft
      + leftCamper.radius
      + DISC_HOCKEY_CREASE_RULE.extraCreaseDepth;
    expect(evaluateDiscHockeyCrease({
      player: { ...leftCamper, x: creaseEdge + 6 },
      puck: safePuck,
      previousSeconds: 1.5,
      deltaSeconds: 0.2,
      collisionMap,
    })).toMatchObject({
      inCrease: true,
      camping: true,
      seconds: 1.7,
    });
    expect(evaluateDiscHockeyCrease({
      player: { ...leftCamper, x: creaseEdge + 9 },
      puck: safePuck,
      previousSeconds: 1.5,
      deltaSeconds: 0.2,
      collisionMap,
    })).toMatchObject({
      inCrease: false,
      camping: false,
      seconds: 0,
    });
  });

  it('ejects goal campers inward with a bounded random angle', () => {
    const downLeft = getDiscHockeyEjectionVelocity({
      side: 'left',
      randomSample: 1,
    });
    const straightLeft = getDiscHockeyEjectionVelocity({
      side: 'left',
      randomSample: 0.5,
    });
    const upRight = getDiscHockeyEjectionVelocity({
      side: 'right',
      randomSample: -10,
    });

    expect(downLeft.angleDegrees).toBe(24);
    expect(downLeft.vx).toBeGreaterThan(0);
    expect(downLeft.vy).toBeGreaterThan(0);
    expect(Math.hypot(downLeft.vx, downLeft.vy)).toBeCloseTo(650, 8);
    expect(straightLeft).toMatchObject({ angleDegrees: 0, vx: 650, vy: 0 });
    expect(upRight.angleDegrees).toBe(-24);
    expect(upRight.vx).toBeLessThan(0);
    expect(upRight.vy).toBeLessThan(0);
    expect(Math.hypot(upRight.vx, upRight.vy)).toBeCloseTo(650, 8);
  });

  it('selects four unique Crazy rivals without selecting the human character', () => {
    expect(selectDiscHockeyCrazyRoster({
      candidateIds: ['joel', 'bob', 'lucia', 'luna', 'juan', 'juanjo'],
      playerId: 'joel',
      randomSamples: [0, 0.99, 0.5, 0],
    })).toEqual(['bob', 'juanjo', 'luna', 'lucia']);

    expect(selectDiscHockeyCrazyRoster({
      candidateIds: ['joel', 'bob', 'lucia', 'luna', 'juan', 'dad', 'mum', 'juanjo'],
      playerId: 'joel',
      randomSamples: [0.75, 0, 0.99, 0.5],
    })).toEqual(['mum', 'bob', 'juanjo', 'juan']);

    const dadAsPlayerRivals = selectDiscHockeyCrazyRoster({
      candidateIds: ['joel', 'bob', 'lucia', 'luna', 'juan', 'dad', 'mum', 'juanjo'],
      playerId: 'dad',
      randomSamples: [0, 0.99, 0.5, 0.25],
    });
    expect(dadAsPlayerRivals).toHaveLength(4);
    expect(new Set(dadAsPlayerRivals).size).toBe(4);
    expect(dadAsPlayerRivals).not.toContain('dad');

    const mumAsPlayerRivals = selectDiscHockeyCrazyRoster({
      candidateIds: ['joel', 'bob', 'lucia', 'luna', 'juan', 'dad', 'mum', 'juanjo'],
      playerId: 'mum',
      randomSamples: [0.85, 0.2, 0.6, 0],
    });
    expect(mumAsPlayerRivals).toHaveLength(4);
    expect(new Set(mumAsPlayerRivals).size).toBe(4);
    expect(mumAsPlayerRivals).not.toContain('mum');
  });

  it('charges Crazy Power only from intentional contacts and recognizes defensive saves', () => {
    expect(DISC_HOCKEY_CRAZY_POWER).toMatchObject({
      maximum: 100,
      passivePerSecond: 1,
      intentionalHitGain: 6,
      defensiveSaveGain: 14,
      intentionalClosingSpeed: 120,
    });
    const player = {
      side: 'left',
      x: 300,
      y: 383,
      vx: 360,
      vy: 0,
    };
    const incomingPuck = {
      x: 360,
      y: 383,
      vx: -240,
      vy: 0,
    };
    const intentional = getDiscHockeyIntentionalHit({
      player,
      puck: incomingPuck,
    });
    expect(intentional.intentional).toBe(true);
    expect(isDiscHockeyDefensiveSave({
      player,
      puck: incomingPuck,
      intentionalHit: intentional,
    })).toBe(true);
    expect(getDiscHockeyIntentionalHit({
      player: { ...player, vx: 0 },
      puck: incomingPuck,
    }).intentional).toBe(false);
    expect(addDiscHockeyCrazyPower({
      energy: 70,
      deltaSeconds: 10,
      gain: 14,
    })).toBe(94);
    expect(addDiscHockeyCrazyPower({
      energy: 96,
      gain: 14,
    })).toBe(100);
  });

  it('creates an unstoppable puck, knocks rivals aside, and ends at the back wall', () => {
    const powered = createDiscHockeyPoweredPuck({
      puck: { x: 500, y: 383, vx: 300, vy: 0, radius: 25 },
      serial: 7,
    });
    expect(powered).toMatchObject({
      powered: true,
      powerSerial: 7,
      vx: DISC_HOCKEY_CRAZY_POWER.poweredPuckSpeed,
      vy: 0,
    });
    const knockback = getDiscHockeyPoweredKnockback({
      puck: powered,
      player: { x: 720, y: 383 },
    });
    expect(Math.hypot(knockback.vx, knockback.vy)).toBeCloseTo(
      DISC_HOCKEY_CRAZY_POWER.knockbackSpeed,
      5,
    );
    expect(Math.abs(knockback.vy)).toBeGreaterThan(Math.abs(knockback.vx));
    expect(shouldEndDiscHockeyPoweredShot({
      before: { x: 1080, vx: 900 },
      after: { x: 1100, vx: -850 },
    })).toBe(true);
    expect(shouldEndDiscHockeyPoweredShot({
      before: { x: 800, vx: 700 },
      after: { x: 820, vx: 650 },
    })).toBe(false);
  });

  it('coordinates four Crazy AI roles and separates overlapping teammates', () => {
    const players = [
      { ...playerSpawnFixture('right', 720, 383), crazyRole: 'striker' },
      { ...playerSpawnFixture('right', 850, 230), crazyRole: 'interceptor' },
      { ...playerSpawnFixture('right', 930, 520), crazyRole: 'defender' },
      { ...playerSpawnFixture('right', 1070, 383), crazyRole: 'goalkeeper' },
    ];
    const assignments = chooseDiscHockeyCrazyTargets({
      players,
      puck: { x: 800, y: 300, vx: 220, vy: 90, radius: 25 },
      human: { x: 500, y: 430 },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.neon,
    });
    expect(new Set(assignments.map(({ role }) => role))).toEqual(
      new Set(DISC_HOCKEY_CRAZY_ROLES),
    );
    assignments.forEach(({ target }) => {
      expect(target.x).toBeGreaterThanOrEqual(
        DISC_HOCKEY_ARENA.centerX + DISC_HOCKEY_ARENA.playerRadius,
      );
    });
    const attackingAssignments = chooseDiscHockeyCrazyTargets({
      players,
      puck: { x: 1000, y: 260, vx: -40, vy: 0, radius: 25 },
      human: { x: 500, y: 430 },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.neon,
    });
    attackingAssignments
      .filter(({ role, target }) => role !== 'striker' && target.x < 1000)
      .forEach(({ target }) => {
        const amount = (1000 - target.x) / (1000 - DISC_HOCKEY_ARENA.left);
        const laneY = 260 + (DISC_HOCKEY_ARENA.centerY - 260) * amount;
        expect(Math.abs(target.y - laneY)).toBeGreaterThanOrEqual(
          DISC_HOCKEY_ARENA.playerRadius * 2.1,
        );
      });
    const safeGoalkeeper = chooseDiscHockeyCrazyTargets({
      players,
      puck: { x: 400, y: 260, vx: 0, vy: 0, radius: 25 },
      human: { x: 500, y: 430 },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.neon,
    }).find(({ role }) => role === 'goalkeeper');
    expect(safeGoalkeeper.target.x).toBeLessThan(
      DISC_HOCKEY_COLLISION_MAPS.neon.goalLineRight
        - DISC_HOCKEY_ARENA.playerRadius
        - DISC_HOCKEY_CREASE_RULE.extraCreaseDepth,
    );
    const separated = separateDiscHockeyPushers({
      players: [
        playerSpawnFixture('right', 800, 383),
        playerSpawnFixture('right', 800, 383),
      ],
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.neon,
    });
    expect(Math.hypot(
      separated[0].x - separated[1].x,
      separated[0].y - separated[1].y,
    )).toBeGreaterThanOrEqual(DISC_HOCKEY_ARENA.playerRadius * 2 + 5.9);
  });

  it('opens a passing lane when the Crazy striker is blocked by midfield', () => {
    const puck = {
      x: DISC_HOCKEY_ARENA.centerX - 12,
      y: DISC_HOCKEY_ARENA.centerY,
      vx: 0,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.puckRadius,
    };
    const players = [
      { ...playerSpawnFixture('right', 690, puck.y), crazyRole: 'striker' },
      { ...playerSpawnFixture('right', 850, 220), crazyRole: 'interceptor' },
      { ...playerSpawnFixture('right', 960, 520), crazyRole: 'defender' },
      { ...playerSpawnFixture('right', 1080, 383), crazyRole: 'goalkeeper' },
    ];
    const striker = chooseDiscHockeyCrazyTargets({
      players,
      puck,
      human: { x: 460, y: DISC_HOCKEY_ARENA.centerY },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    }).find(({ role }) => role === 'striker');

    expect(striker.midfieldRelease).toBe(true);
    expect(striker.target.x).toBeGreaterThan(
      DISC_HOCKEY_ARENA.centerX + DISC_HOCKEY_ARENA.playerRadius + 60,
    );
    expect(Math.abs(striker.target.y - puck.y)).toBeGreaterThan(
      DISC_HOCKEY_ARENA.playerRadius + puck.radius,
    );
  });

  it('routes around a top-wall puck before striking it hard toward open ice', () => {
    const puck = {
      x: 850,
      y: DISC_HOCKEY_COLLISION_MAPS.ice.bounds.top + DISC_HOCKEY_ARENA.puckRadius,
      vx: 0,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.puckRadius,
    };
    const wrongSideStriker = {
      ...playerSpawnFixture('right', 760, 170),
      crazyRole: 'striker',
    };
    const players = [
      wrongSideStriker,
      { ...playerSpawnFixture('right', 990, 500), crazyRole: 'interceptor' },
      { ...playerSpawnFixture('right', 1040, 360), crazyRole: 'defender' },
      { ...playerSpawnFixture('right', 1110, 520), crazyRole: 'goalkeeper' },
    ];
    const routing = chooseDiscHockeyCrazyTargets({
      players,
      puck,
      human: { x: 420, y: 520 },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    }).find(({ player }) => player === wrongSideStriker);

    expect(routing.role).toBe('striker');
    expect(routing.attackPhase).toBe('route');
    expect(routing.target.x).toBeCloseTo(wrongSideStriker.x, 5);
    expect(routing.target.y).toBeGreaterThan(
      puck.y + DISC_HOCKEY_ARENA.playerRadius + puck.radius,
    );

    const linedUpStriker = {
      ...wrongSideStriker,
      x: puck.x + DISC_HOCKEY_ARENA.playerRadius + puck.radius + 32,
      y: DISC_HOCKEY_COLLISION_MAPS.ice.bounds.top + DISC_HOCKEY_ARENA.playerRadius,
    };
    const striking = chooseDiscHockeyCrazyTargets({
      players: [linedUpStriker, ...players.slice(1)],
      puck,
      human: { x: 420, y: 520 },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    }).find(({ player }) => player === linedUpStriker);
    expect(striking.attackPhase).toBe('strike');
    expect(striking.target.x).toBeLessThan(puck.x - 100);

    const shot = createDiscHockeyCrazyAttackPuck({
      puck: { ...puck, vx: -90, vy: -30 },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    });
    expect(shot.vx).toBeLessThan(-DISC_HOCKEY_CRAZY_AI.attack.minimumShotSpeed * 0.9);
    expect(shot.vy).toBeGreaterThan(0);
    expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(
      DISC_HOCKEY_CRAZY_AI.attack.minimumShotSpeed,
      5,
    );
  });

  it('repels a stalled contacted puck toward legal open ice', () => {
    const player = playerSpawnFixture('right', 690, DISC_HOCKEY_ARENA.centerY);
    const puck = {
      x: 630,
      y: DISC_HOCKEY_ARENA.centerY,
      vx: 0,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.puckRadius,
      powered: false,
    };
    const released = createDiscHockeyStallReflexPuck({
      puck,
      player,
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    });

    expect(DISC_HOCKEY_STALL_REFLEX.triggerSeconds).toBe(3);
    expect(released.vx).toBeLessThan(-DISC_HOCKEY_STALL_REFLEX.puckSpeed * 0.8);
    expect(Math.hypot(released.vx, released.vy)).toBeCloseTo(
      DISC_HOCKEY_STALL_REFLEX.puckSpeed,
      5,
    );

    const boardRelease = createDiscHockeyStallReflexPuck({
      puck: {
        ...puck,
        x: 470,
        y: DISC_HOCKEY_COLLISION_MAPS.ice.bounds.top + puck.radius,
      },
      player: playerSpawnFixture(
        'left',
        470,
        DISC_HOCKEY_COLLISION_MAPS.ice.bounds.top + puck.radius + player.radius,
      ),
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    });
    expect(boardRelease.vy).toBeGreaterThan(0);
  });

  it('gives exactly the Crazy striker a meaningful overdrive advantage', () => {
    const strikerMotion = getDiscHockeyCrazyRoleMotion('striker');
    expect(strikerMotion).toEqual(DISC_HOCKEY_CRAZY_AI.striker);
    expect(strikerMotion.aggressive).toBe(true);
    expect(strikerMotion.maxSpeed).toBeGreaterThan(DISC_HOCKEY_AI.hard.maxSpeed * 1.5);
    expect(strikerMotion.response).toBeGreaterThan(DISC_HOCKEY_CRAZY_AI.support.response);

    DISC_HOCKEY_CRAZY_ROLES
      .filter((role) => role !== 'striker')
      .forEach((role) => {
        expect(getDiscHockeyCrazyRoleMotion(role)).toEqual(DISC_HOCKEY_CRAZY_AI.support);
        expect(getDiscHockeyCrazyRoleMotion(role).aggressive).toBe(false);
      });
  });

  it.each([
    {
      corner: 'bottom',
      puck: { x: 1100, y: 575, vx: 0, vy: 0, radius: 25 },
      expectedVerticalApproach: -1,
    },
    {
      corner: 'top',
      puck: { x: 1100, y: 157, vx: 0, vy: 0, radius: 25 },
      expectedVerticalApproach: 1,
    },
    {
      corner: 'top',
      puck: { x: 1135, y: 300, vx: 0, vy: 0, radius: 25 },
      expectedVerticalApproach: 1,
    },
    {
      corner: 'bottom',
      puck: { x: 1135, y: 410, vx: 0, vy: 0, radius: 25 },
      expectedVerticalApproach: -1,
    },
  ])('sends only one Crazy AI retriever into the $corner corner', ({
    corner,
    puck,
    expectedVerticalApproach,
  }) => {
    const players = [
      { ...playerSpawnFixture('right', 1040, puck.y), crazyRole: 'striker' },
      { ...playerSpawnFixture('right', 1000, puck.y - 35), crazyRole: 'interceptor' },
      { ...playerSpawnFixture('right', 1070, puck.y + 25), crazyRole: 'defender' },
      { ...playerSpawnFixture('right', 1090, puck.y - 70), crazyRole: 'goalkeeper' },
    ];
    const assignments = chooseDiscHockeyCrazyTargets({
      players,
      puck,
      human: { x: 460, y: DISC_HOCKEY_ARENA.centerY },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.neon,
    });
    const striker = assignments.find(({ role }) => role === 'striker');
    const support = assignments.filter(({ role }) => role !== 'striker');

    expect(assignments.every(({ cornerRecovery }) => cornerRecovery === corner)).toBe(true);
    expect(striker.target.x).toBeLessThan(puck.x);
    expect(Math.sign(striker.target.y - puck.y)).toBe(expectedVerticalApproach);
    expect(Math.hypot(
      striker.target.x - puck.x,
      striker.target.y - puck.y,
    )).toBeLessThan(100);
    support.forEach(({ target }) => {
      expect(Math.hypot(target.x - puck.x, target.y - puck.y)).toBeGreaterThan(180);
    });
  });

  it('makes the Crazy striker retreat while a corner-bank rebound escapes', () => {
    const puck = {
      x: 1100,
      y: 157,
      vx: -320,
      vy: 280,
      radius: 25,
    };
    const assignments = chooseDiscHockeyCrazyTargets({
      players: [
        { ...playerSpawnFixture('right', 1030, 245), crazyRole: 'striker' },
        { ...playerSpawnFixture('right', 930, 220), crazyRole: 'interceptor' },
        { ...playerSpawnFixture('right', 980, 470), crazyRole: 'defender' },
        { ...playerSpawnFixture('right', 1090, 383), crazyRole: 'goalkeeper' },
      ],
      puck,
      human: { x: 460, y: DISC_HOCKEY_ARENA.centerY },
      collisionMap: DISC_HOCKEY_COLLISION_MAPS.ice,
    });
    const striker = assignments.find(({ role }) => role === 'striker');

    expect(striker.cornerRecovery).toBe('top');
    expect(striker.target.x).toBeLessThan(puck.x - 130);
    expect(striker.target.y).toBeGreaterThan(puck.y + 110);
    expect(Math.hypot(
      striker.target.x - puck.x,
      striker.target.y - puck.y,
    )).toBeGreaterThan(190);

    const topBank = createDiscHockeyCornerBankPuck({ puck, corner: 'top' });
    expect(topBank.vx).toBeLessThanOrEqual(-520);
    expect(topBank.vy).toBeGreaterThanOrEqual(320);
    const bottomBank = createDiscHockeyCornerBankPuck({ puck, corner: 'bottom' });
    expect(bottomBank.vx).toBeLessThanOrEqual(-520);
    expect(bottomBank.vy).toBeLessThanOrEqual(-320);
  });

  it('bounces off boards but leaves the goal mouth open', () => {
    const collisionMap = DISC_HOCKEY_COLLISION_MAPS.ice;
    const wallBounce = stepPuck({
      puck: { x: 640, y: 130, vx: 0, vy: -300, radius: 25 },
      deltaSeconds: 0.1,
      collisionMap,
    });
    expect(closestPointOnCollisionContour({
      ...wallBounce,
      collisionMap,
    }).distance).toBeCloseTo(25, 4);
    expect(wallBounce.vy).toBeGreaterThan(0);

    const goalLane = stepPuck({
      puck: {
        x: collisionMap.goalLineLeft - 10,
        y: DISC_HOCKEY_ARENA.centerY,
        vx: -300,
        vy: 0,
        radius: 25,
      },
      deltaSeconds: 0.1,
      collisionMap,
    });
    expect(goalLane.x).toBeLessThan(collisionMap.goalLineLeft);
    expect(goalLane.vx).toBeLessThan(0);
  });

  it('keeps normal air-hockey hits gliding while settling only very soft motion', () => {
    let gliding = {
      x: 640,
      y: DISC_HOCKEY_ARENA.centerY,
      vx: 60,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.puckRadius,
    };
    let soft = { ...gliding, x: 400, vx: 10 };
    for (let frame = 0; frame < 300; frame += 1) {
      gliding = stepPuck({ puck: gliding, deltaSeconds: 1 / 60 });
      soft = stepPuck({ puck: soft, deltaSeconds: 1 / 60 });
    }
    expect(DISC_HOCKEY_PUCK_SURFACE.damping).toBeLessThan(0.1);
    expect(Math.hypot(gliding.vx, gliding.vy)).toBeGreaterThan(44);
    expect(soft.vx).toBe(0);
    expect(soft.vy).toBe(0);
  });

  it('reflects puck velocity along the traced corner segments', () => {
    const collisionMap = DISC_HOCKEY_COLLISION_MAPS.neon;
    const bounced = stepPuck({
      puck: {
        x: 190,
        y: 135,
        vx: -260,
        vy: -180,
        radius: DISC_HOCKEY_ARENA.puckRadius,
      },
      deltaSeconds: 1 / 30,
      collisionMap,
    });
    const wall = closestPointOnCollisionContour({
      ...bounced,
      collisionMap,
    });
    expect(wall.inside).toBe(true);
    expect(wall.distance).toBeCloseTo(DISC_HOCKEY_ARENA.puckRadius, 5);
    expect(bounced.vx).not.toBeCloseTo(-260, 2);
    expect(bounced.vy).not.toBeCloseTo(-180, 2);
  });

  it('scores once 40% of the puck enters a goal', () => {
    const collisionMap = DISC_HOCKEY_COLLISION_MAPS.neon;
    const shared = { y: DISC_HOCKEY_ARENA.centerY, vx: 0, vy: 0, radius: 25 };
    expect(collisionMap.goalOverlapFraction).toBe(0.4);
    expect(detectDiscHockeyGoal({
      puck: { ...shared, x: collisionMap.goalLineLeft + 5.5 },
      collisionMap,
    })).toBeNull();
    expect(detectDiscHockeyGoal({
      puck: { ...shared, x: collisionMap.goalLineLeft + 5 },
      collisionMap,
    })).toBe('right');
    expect(detectDiscHockeyGoal({
      puck: { ...shared, x: collisionMap.goalLineRight - 5 },
      collisionMap,
    })).toBe('left');
    expect(detectDiscHockeyGoal({
      puck: { ...shared, x: collisionMap.goalLineRight - 5, y: collisionMap.goalTop + 24 },
      collisionMap,
    })).toBeNull();
  });

  it('gives harder AI faster reactions, movement, and prediction', () => {
    expect(DISC_HOCKEY_AI.easy.reactionSeconds).toBeGreaterThan(DISC_HOCKEY_AI.normal.reactionSeconds);
    expect(DISC_HOCKEY_AI.normal.reactionSeconds).toBeGreaterThan(DISC_HOCKEY_AI.hard.reactionSeconds);
    expect(DISC_HOCKEY_AI.hard.maxSpeed).toBeGreaterThan(DISC_HOCKEY_AI.easy.maxSpeed);
    expect(getDiscHockeyAiTuning('invalid')).toBe(DISC_HOCKEY_AI.normal);

    const puck = { x: 900, y: 300, vx: 180, vy: 200 };
    const player = { x: 1000, y: 383, radius: 44 };
    const easy = chooseDiscHockeyAiTarget({ puck, player, difficulty: 'easy' });
    const hard = chooseDiscHockeyAiTarget({ puck, player, difficulty: 'hard' });
    expect(hard.y).toBeGreaterThan(easy.y);
    expect(hard.x).toBeGreaterThanOrEqual(DISC_HOCKEY_ARENA.centerX + player.radius);

    const opponentSidePuck = { x: 520, y: 520, vx: 0, vy: 0, radius: 25 };
    const easyGuard = chooseDiscHockeyAiTarget({
      puck: opponentSidePuck,
      player,
      difficulty: 'easy',
    });
    const hardPress = chooseDiscHockeyAiTarget({
      puck: opponentSidePuck,
      player,
      difficulty: 'hard',
    });
    expect(hardPress.x).toBeLessThan(easyGuard.x);
    expect(hardPress.x).toBeCloseTo(DISC_HOCKEY_AI.hard.pressX, 5);
    expect(Math.abs(hardPress.y - opponentSidePuck.y)).toBeLessThan(
      Math.abs(easyGuard.y - opponentSidePuck.y),
    );

    const contestedPuck = {
      x: 630,
      y: DISC_HOCKEY_ARENA.centerY,
      vx: -90,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.puckRadius,
    };
    const angledPress = chooseDiscHockeyAiTarget({
      puck: contestedPuck,
      player,
      difficulty: 'hard',
    });
    expect(angledPress.y).not.toBe(contestedPuck.y);
    expect(Math.hypot(
      angledPress.x - contestedPuck.x,
      angledPress.y - contestedPuck.y,
    )).toBeLessThanOrEqual(player.radius + contestedPuck.radius);
  });

  it('has hard AI chase and strike a stationary puck on its own half', () => {
    let player = {
      side: 'right',
      x: 1050,
      y: 540,
      vx: 0,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.playerRadius,
    };
    let puck = {
      x: 780,
      y: 540,
      vx: 0,
      vy: 0,
      radius: DISC_HOCKEY_ARENA.puckRadius,
    };
    for (let frame = 0; frame < 50; frame += 1) {
      const target = chooseDiscHockeyAiTarget({
        puck,
        player,
        difficulty: 'hard',
      });
      player = moveDiscTowardTarget({
        disc: player,
        target,
        side: 'right',
        maxSpeed: DISC_HOCKEY_AI.hard.maxSpeed,
        deltaSeconds: 1 / 60,
      });
      const collision = resolvePlayerPuckCollision({ player, puck });
      puck = stepPuck({ puck: collision.puck, deltaSeconds: 1 / 60 });
    }
    expect(player.x).toBeLessThan(950);
    expect(puck.x).toBeLessThan(740);
    expect(puck.vx).toBeLessThan(-50);
  });

  describe('computer recovery and goal defence (playtest 2026-10-12)', () => {
    const player = { side: 'right', x: 760, y: 390, vx: 0, vy: 0, radius: DISC_HOCKEY_ARENA.playerRadius };
    // Captured from the playtest loop: the rival's bank shot off the top boards.
    const bankShot = { x: 646, y: 250, vx: 715, vy: -579, radius: DISC_HOCKEY_ARENA.puckRadius };

    it.each(['ice', 'neon'])('guards the %s goal from outside its own crease', (themeId) => {
      const collisionMap = getDiscHockeyCollisionMap(themeId);
      const guard = chooseDiscHockeyAiGuardTarget({
        puck: { x: 300, y: 383, vx: 0, vy: 0 },
        player,
        collisionMap,
      });
      expect(guard.x).toBeCloseTo(getDiscHockeyAiGuardX({ radius: player.radius, collisionMap }), 5);
      expect(guard.y).toBeGreaterThan(collisionMap.goalTop);
      expect(guard.y).toBeLessThan(collisionMap.goalBottom);
      const crease = evaluateDiscHockeyCrease({
        player: { ...player, ...guard },
        puck: { x: 300, y: 383 },
        collisionMap,
        previousSeconds: 3,
        deltaSeconds: 1,
      });
      expect(crease.inCrease).toBe(false);
      expect(crease.violated).toBe(false);
    });

    it('predicts a bank shot off the side boards', () => {
      const y = predictDiscHockeyPuckY({ puck: bankShot, x: 1148 });
      // Up to the top boards (y = 141) and back down into the goal mouth.
      expect(y).toBeGreaterThan(292);
      expect(y).toBeLessThan(474);
    });

    it('treats the bank shot as a threat and meets it instead of chasing the boards', () => {
      const collisionMap = getDiscHockeyCollisionMap('ice');
      expect(isDiscHockeyGoalThreat({ puck: bankShot, player, difficulty: 'normal', collisionMap })).toBe(true);
      expect(isDiscHockeyGoalThreat({ puck: { ...bankShot, vx: -715 }, player, difficulty: 'normal', collisionMap })).toBe(false);
      const target = chooseDiscHockeyAiTarget({ puck: bankShot, player, difficulty: 'normal', collisionMap });
      // Before the fix Normal went up to the boards with the puck (y about 168).
      expect(target.x).toBeGreaterThan(player.x);
      expect(target.y).toBeGreaterThan(200);
    });

    it('returns to its guard line after a restart on every difficulty, then presses', () => {
      const collisionMap = getDiscHockeyCollisionMap('ice');
      const centredPuck = { x: DISC_HOCKEY_ARENA.centerX, y: DISC_HOCKEY_ARENA.centerY, vx: 0, vy: 0 };
      const spawn = { ...player, x: 950, y: DISC_HOCKEY_ARENA.centerY };
      ['easy', 'normal', 'hard'].forEach((difficulty) => {
        const recovering = chooseDiscHockeyAiTarget({ puck: centredPuck, player: spawn, difficulty, collisionMap, recovering: true });
        expect(recovering.x).toBeCloseTo(getDiscHockeyAiGuardX({ radius: player.radius, collisionMap }), 5);
        const { recoverySeconds } = getDiscHockeyAiTuning(difficulty);
        expect(shouldDiscHockeyAiEndRecovery({ puck: centredPuck, player: spawn, elapsedSeconds: recoverySeconds / 2, difficulty, collisionMap })).toBe(false);
        // Still walking back: keep recovering even after the time is up.
        expect(shouldDiscHockeyAiEndRecovery({ puck: centredPuck, player: spawn, elapsedSeconds: recoverySeconds, difficulty, collisionMap })).toBe(false);
        expect(shouldDiscHockeyAiEndRecovery({ puck: centredPuck, player: { ...spawn, ...recovering }, elapsedSeconds: recoverySeconds, difficulty, collisionMap })).toBe(true);
        // A slow puck deep in its half is cleared at once.
        expect(shouldDiscHockeyAiEndRecovery({ puck: { x: 900, y: 300, vx: 20, vy: 0 }, player: spawn, elapsedSeconds: 0, difficulty, collisionMap })).toBe(true);
      });
      expect(DISC_HOCKEY_AI.easy.recoverySeconds).toBeGreaterThan(DISC_HOCKEY_AI.normal.recoverySeconds);
      expect(DISC_HOCKEY_AI.normal.recoverySeconds).toBeGreaterThan(DISC_HOCKEY_AI.hard.recoverySeconds);
    });
  });
});
