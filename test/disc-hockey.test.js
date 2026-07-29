import { describe, expect, it } from 'vitest';
import {
  DISC_HOCKEY_AI,
  DISC_HOCKEY_ARENA,
  DISC_HOCKEY_HUMAN_CONTROL,
  DISC_HOCKEY_MATCH_SECONDS,
  DISC_HOCKEY_PUCK_SURFACE,
  chooseDiscHockeyAiTarget,
  clampDiscPlayerPosition,
  closestPointOnCollisionContour,
  constrainDiscToCollisionMap,
  detectDiscHockeyGoal,
  formatDiscHockeyTime,
  getDiscHockeyAiTuning,
  getDiscHockeyHumanMotion,
  getDiscHockeyMatchResult,
  moveDiscDirectlyTowardTarget,
  moveDiscTowardTarget,
  resolvePlayerPuckCollision,
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
    expect(hit.puck.x).toBeGreaterThan(puck.x);
    expect(hit.puck.vx).toBeGreaterThan(player.vx);
    expect(resolvePlayerPuckCollision({
      player,
      puck: { ...puck, x: 500 },
    }).collided).toBe(false);
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
});
