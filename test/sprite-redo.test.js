import { describe, expect, it } from 'vitest';
import {
  CHARACTER_FRAMES,
  CHARACTER_GAMEPLAY_HEIGHT,
  CHARACTER_GROUND_ANCHOR_Y,
  CHARACTER_LAYOUTS,
  KICK_VISUAL_SECONDS,
  celebrateVisualAt,
  chilenaVisualAt,
  CHILENA_CONTACT_HOLD_SECONDS,
  getCharacterLayout,
  idleVisualAt,
  isGroundedVisualFrame,
  isLayoutGroundedFrame,
  kickVisualAt,
  layoutDisplayWidth,
  layoutKickVisualAt,
  layoutRunVisualAt,
  runCycleAdvance,
  runVisualAt,
  secondaryMotionAt,
  sprintVisualAt,
  hitVisualAt,
  HIT_IMPACT_SECONDS,
  HIT_RECOVER_SECONDS,
} from '../src/game/pure/characterAnimation.js';
import {
  CHILENA_CONTACT_MAX_SECONDS,
  CHILENA_CONTACT_MIN_SECONDS,
  CHILENA_CONTACT_SLOP,
  CHILENA_FORGIVE_RADIUS,
  CHILENA_FRAMED_MIN_UPWARD_RATIO,
  CHILENA_GUIDE_MAX_SECONDS,
  chilenaContactTargetSeconds,
  evaluateChilenaEligibility,
  planFramedChilena,
  resolveChilenaContact,
} from '../src/game/pure/chilena.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, getCharacter } from '../src/game/content/characters.js';
import {
  getCharacterCollisionProfile,
  getFootballCollisionGeometry,
} from '../src/game/content/characterCollisionProfiles.js';

const classic = CHARACTER_LAYOUTS.classic;
const v2 = CHARACTER_LAYOUTS['roster-v2'];

describe('character atlas layouts', () => {
  it('keeps the classic layout frame-for-frame identical to the original runtime', () => {
    // No catalog character uses the classic atlas any more (the whole roster
    // is roster-v2); the layout stays the fallback for a sheet without one.
    expect(CHARACTERS.filter((character) => getCharacterLayout(character) === classic)).toEqual([]);
    expect(getCharacterLayout(null)).toBe(classic);
    expect(layoutDisplayWidth(classic)).toBeCloseTo(280 * 320 / 480);
    expect(idleVisualAt(classic, 3.7).frame).toBe(CHARACTER_FRAMES.idle);
    for (let cycle = 0; cycle < 9; cycle += 0.5) {
      expect(layoutRunVisualAt(classic, cycle)).toEqual(runVisualAt(cycle));
    }
    for (let remaining = KICK_VISUAL_SECONDS; remaining >= 0; remaining -= 0.01) {
      const expected = kickVisualAt({ remaining, duration: KICK_VISUAL_SECONDS });
      expect(layoutKickVisualAt(classic, { remaining, duration: KICK_VISUAL_SECONDS })).toEqual(expected);
    }
    for (let frame = 0; frame < 12; frame += 1) {
      expect(isLayoutGroundedFrame(classic, frame)).toBe(isGroundedVisualFrame(frame));
    }
    expect(classic.chilenaFramed).toBe(false);
    expect(chilenaVisualAt(classic).frame).toBe(CHARACTER_FRAMES.legacyKick);
  });

  it('describes the roster-v2 atlas: 24 cells of 336x480 with one drawing scale', () => {
    for (const character of CHARACTERS) expect(getCharacterLayout(character), character.id).toBe(v2);
    expect(v2.frameWidth).toBe(336);
    expect(v2.frameHeight).toBe(480);
    expect(v2.frameCount).toBe(24);
    // 6 x 4 cells stay inside the 2048 px texture guardrail.
    expect(v2.frameWidth * 6).toBeLessThanOrEqual(2048);
    expect(v2.frameHeight * 4).toBeLessThanOrEqual(2048);
    const used = [
      ...v2.idle, ...v2.run, ...v2.kick.map(({ frame }) => frame),
      v2.jump, v2.hit.impact, v2.hit.stagger, v2.hit.recover,
      v2.chilena.takeoff, v2.chilena.contact, v2.chilena.follow,
      ...v2.celebrate,
    ];
    // The sprint reuses the run's two opposite full strides: no cells of its own.
    expect(v2.sprint.every((frame) => v2.run.includes(frame))).toBe(true);
    expect([...new Set(used)].sort((a, b) => a - b)).toEqual([...Array(24).keys()]);
    // Airborne drawings are not ground-registered.
    expect(isLayoutGroundedFrame(v2, v2.jump)).toBe(false);
    expect(isLayoutGroundedFrame(v2, v2.chilena.contact)).toBe(false);
    expect(isLayoutGroundedFrame(v2, v2.idle[0])).toBe(true);
  });

  it('ping-pongs the authored idle loop and cycles the celebrate loop at their layout rates', () => {
    expect(v2.idleFps).toBe(10);
    expect(v2.celebrateFps).toBe(12);
    const idleFrames = [0, 1, 2, 3, 4, 5].map((step) => idleVisualAt(v2, step / v2.idleFps + 0.01).frame);
    expect(idleFrames).toEqual([0, 1, 2, 1, 0, 1]);
    const celebrateFrames = [0, 1, 2, 3, 4].map((step) => celebrateVisualAt(v2, step / v2.celebrateFps + 0.01).frame);
    expect(celebrateFrames).toEqual([20, 21, 22, 23, 20]);
  });

  it('keeps the run between 14 and 24 drawings per second on roster-v2, and classic purely distance-driven', () => {
    const tick = 1 / 60;
    // drawings per second for a constant ground speed (px/s)
    const drawingsPerSecond = (layout, speed) => {
      const phases = runCycleAdvance(layout, { travelled: speed * tick, dt: tick });
      return (phases * (layout.run.length / 4)) / tick;
    };
    expect(drawingsPerSecond(v2, 120)).toBeCloseTo(14);
    expect(drawingsPerSecond(v2, 400)).toBeCloseTo(14);
    // Between the bounds the feet follow the ground: 6 drawings per 328 px stride.
    expect(drawingsPerSecond(v2, 1000)).toBeCloseTo(1000 / (82 * 4 / 6));
    expect(drawingsPerSecond(v2, 1600)).toBeCloseTo(24);
    // Classic timing is unchanged for the characters still on the old atlas.
    expect(runCycleAdvance(classic, { travelled: 41, dt: tick })).toBeCloseTo(0.5);
    expect(runCycleAdvance(classic, { travelled: 0, dt: tick })).toBe(0);
  });

  it('advances six run drawings over the same stride distance as the classic four', () => {
    // One classic cycle (4 phases) covers one full stride; v2 covers its 6 drawings.
    const phases = [0, 1, 2, 3].map((cycle) => layoutRunVisualAt(v2, cycle + 0.01).phase);
    expect(phases).toEqual([0, 1, 3, 4]);
    expect(layoutRunVisualAt(v2, 4.01).phase).toBe(0);
    expect(layoutRunVisualAt(v2, 0.01).footstep).toBe(true);
    expect(layoutRunVisualAt(v2, 2.01).footstep).toBe(true);
    expect(layoutRunVisualAt(v2, 1.01).footstep).toBe(false);
  });

  it('shows the kick contact drawing while the gameplay strike can still connect', () => {
    const at = (elapsed) => layoutKickVisualAt(v2, {
      remaining: KICK_VISUAL_SECONDS - elapsed,
      duration: KICK_VISUAL_SECONDS,
    });
    expect(at(0).stage).toBe('anticipation');
    expect(at(0.06).frame).toBe(v2.kickContact);
    expect(at(0.15).frame).toBe(v2.kickContact);
    expect(at(0.2).stage).toBe('recovery');
    expect(at(KICK_VISUAL_SECONDS).frame).toBe(12);
  });

  it('alternates the sprint strides under a strong lean; classic keeps one dash drawing', () => {
    const strides = [0, 1, 2, 3].map((step) => sprintVisualAt(v2, step / v2.sprintFps + 0.005).frame);
    expect(strides).toEqual([3, 6, 3, 6]);
    expect(sprintVisualAt(classic, 0.1)).toBeNull();
    const lean = secondaryMotionAt({ pose: 'dash', dashDirection: 1, dashLeanDegrees: v2.sprintLeanDegrees });
    expect(lean.angle).toBe(9);
    expect(secondaryMotionAt({ pose: 'dash', dashDirection: -1 }).angle).toBe(-3.5);
  });

  it('plays the hit reaction as impact, stagger, then recover before the stun ends', () => {
    expect(hitVisualAt(v2, { elapsed: 0.02, remaining: 0.5 }).frame).toBe(v2.hit.impact);
    expect(hitVisualAt(v2, { elapsed: HIT_IMPACT_SECONDS + 0.01, remaining: 0.4 }).frame).toBe(v2.hit.stagger);
    expect(hitVisualAt(v2, { elapsed: 0.5, remaining: HIT_RECOVER_SECONDS - 0.01 }).frame).toBe(v2.hit.recover);
    expect(hitVisualAt(classic, { elapsed: 0.02, remaining: 0.5 }).frame).toBe(CHARACTER_FRAMES.stun);
  });

  it('holds the chilena contact drawing from the moment of contact, then follows through', () => {
    expect(chilenaVisualAt(v2, { contactAt: null, elapsed: 0.1 }).frame).toBe(v2.chilena.takeoff);
    expect(chilenaVisualAt(v2, { contactAt: 0.2, elapsed: 0.2 }).frame).toBe(v2.chilena.contact);
    expect(chilenaVisualAt(v2, { contactAt: 0.2, elapsed: 0.2 + CHILENA_CONTACT_HOLD_SECONDS - 0.01 }).frame)
      .toBe(v2.chilena.contact);
    expect(chilenaVisualAt(v2, { contactAt: 0.2, elapsed: 0.2 + CHILENA_CONTACT_HOLD_SECONDS }).frame)
      .toBe(v2.chilena.follow);
  });
});

describe('kid collision profile', () => {
  it('keeps the adult footprint and lowers only the head cap to the kid drawing', () => {
    const bob = getCharacter('bob');
    expect(getCharacterCollisionProfile(bob).id).toBe('kid');
    const kid = getFootballCollisionGeometry(bob);
    const adult = getFootballCollisionGeometry(getCharacter('dad'));
    expect(kid.bodyScale).toBe(adult.bodyScale);
    // 330 px idle in the 480 px cell is 192.5 world px.
    expect(kid.headTop).toBe(193);
    expect(kid.headCapY).toBeGreaterThan(adult.headCapY);
    expect(adult.headCapY - kid.headCapY).toBeCloseTo(-29, 0);
  });
});

describe('framed chilena guidance', () => {
  it('plans later contact for higher balls within the authored window', () => {
    expect(chilenaContactTargetSeconds({ upwardDistance: 0, height: 240 })).toBe(CHILENA_CONTACT_MIN_SECONDS);
    expect(chilenaContactTargetSeconds({ upwardDistance: 240, height: 240 })).toBeCloseTo(0.3);
    expect(chilenaContactTargetSeconds({ upwardDistance: 999, height: 240 })).toBe(CHILENA_CONTACT_MAX_SECONDS);
  });

  it('only reports contact when the boot reaches the ball, and gives up on a ball that left', () => {
    const boot = { x: 600, y: 400 };
    expect(resolveChilenaContact({ boot, ball: { x: 600, y: 400 + 22 + CHILENA_CONTACT_SLOP }, elapsed: 0.05 }))
      .toBe('contact');
    expect(resolveChilenaContact({ boot, ball: { x: 600, y: 520 }, elapsed: 0.05, targetSeconds: 0.2 }))
      .toBe('pending');
    // 28 px surface gap: inside the forgiving radius at the planned time.
    expect(resolveChilenaContact({ boot, ball: { x: 600, y: 450 }, elapsed: 0.2, targetSeconds: 0.2 }))
      .toBe('contact');
    // 48 px: too far to count as a touch, even at the planned time.
    expect(resolveChilenaContact({ boot, ball: { x: 600, y: 470 }, elapsed: 0.2, targetSeconds: 0.2 }))
      .toBe('pending');
    // Before the planned time, a close ball that starts moving away is struck now.
    expect(resolveChilenaContact({
      boot, ball: { x: 600, y: 450 }, elapsed: 0.05, targetSeconds: 0.2, previousSurfaceDistance: 20,
    })).toBe('contact');
    expect(resolveChilenaContact({
      boot, ball: { x: 600, y: 450 }, elapsed: 0.05, targetSeconds: 0.2, previousSurfaceDistance: 40,
    })).toBe('pending');
    expect(resolveChilenaContact({ boot, ball: { x: 900, y: 100 }, elapsed: CHILENA_GUIDE_MAX_SECONDS }))
      .toBe('missed');
  });

  // A character's measured contact boot relative to (body x, body bottom),
  // world px. The sweeps run for every roster character: the boot height
  // differs a lot (Mum y=70 .. Luna y=156 in the 480 px cell).
  const contactOf = (id) => getCharacter(id).chilenaContact;
  const bootOffset = (facing, contact = contactOf('bob')) => ({
    x: (contact.x - v2.frameWidth / 2) * (280 / 480) * facing,
    y: (contact.y - CHARACTER_GROUND_ANCHOR_Y) * (280 / 480),
  });
  const plan = ({ ballDx, ballUp, ballVx = 0, ballVy = 0, facing = -1, contact }) => {
    const fighter = { x: 640, y: 566, bodyBottomOffset: 70 };
    const ball = { x: fighter.x + ballDx, y: fighter.y - ballUp, vx: ballVx, vy: ballVy, radius: 22 };
    const eligibility = evaluateChilenaEligibility({
      fighter: { x: fighter.x, y: fighter.y, height: CHARACTER_GAMEPLAY_HEIGHT, grounded: true },
      ball,
      kickPresses: 2,
    });
    if (!eligibility.allowed) return null;
    return planFramedChilena({
      fighter,
      ball,
      bootOffset: bootOffset(facing, contact),
      groundY: 636,
      targetSeconds: chilenaContactTargetSeconds({
        upwardDistance: eligibility.upwardDistance,
        height: eligibility.maximumDistance,
      }),
    });
  };

  it('meets every still ball above head height with the boot of the contact drawing', () => {
    // Eligibility starts at 43 px above the body centre (chest height); balls
    // that low cannot be met by an overhead boot and stay ordinary kicks.
    const contact = contactOf('bob');
    for (let ballUp = 76; ballUp <= 236; ballUp += 16) {
      for (let ballDx = -108; ballDx <= 108; ballDx += 12) {
        for (const facing of [-1, 1]) {
          const result = plan({ ballDx, ballUp, facing, contact });
          if (!result) continue;
          expect(result, JSON.stringify({ ballDx, ballUp, facing })).toMatchObject({ reachable: true });
          expect(result.surfaceDistance).toBeLessThanOrEqual(CHILENA_FORGIVE_RADIUS);
          expect(result.contactSeconds).toBeLessThanOrEqual(CHILENA_GUIDE_MAX_SECONDS);
        }
      }
    }
  });

  it('keeps most of the eligible zone reachable and only starts chilenas that connect', () => {
    const contact = contactOf('bob');
    let eligible = 0;
    let reachable = 0;
    for (let ballUp = 44; ballUp <= 240; ballUp += 8) {
      for (let ballDx = -108; ballDx <= 108; ballDx += 12) {
        for (const [ballVx, ballVy] of [[0, 0], [3, -2], [-3, 4], [0, 6], [4, 0], [-4, 0]]) {
          for (const facing of [-1, 1]) {
            const result = plan({ ballDx, ballUp, ballVx, ballVy, facing, contact });
            if (!result) continue;
            eligible += 1;
            if (!result.reachable) continue;
            reachable += 1;
            expect(result.surfaceDistance).toBeLessThanOrEqual(CHILENA_FORGIVE_RADIUS);
          }
        }
      }
    }
    expect(eligible).toBeGreaterThan(5000);
    expect(reachable / eligible).toBeGreaterThan(0.85);
  });

  it('refuses a low ball that is already falling away from the overhead boot', () => {
    expect(plan({ ballDx: -108, ballUp: 44, ballVx: -3, ballVy: 4, facing: 1 })).toMatchObject({
      reachable: false,
    });
  });

  it('starts a framed chilena only where every still ball is reachable (B2)', () => {
    const contact = contactOf('bob');
    const minimum = CHARACTER_GAMEPLAY_HEIGHT * CHILENA_FRAMED_MIN_UPWARD_RATIO;
    expect(minimum).toBeGreaterThanOrEqual(76);
    let eligible = 0;
    for (let ballUp = 40; ballUp <= 236; ballUp += 4) {
      for (let ballDx = -108; ballDx <= 108; ballDx += 12) {
        for (const facing of [-1, 1]) {
          const fighter = { x: 640, y: 566, bodyBottomOffset: 70 };
          const ball = { x: fighter.x + ballDx, y: fighter.y - ballUp, vx: 0, vy: 0, radius: 22 };
          const gate = evaluateChilenaEligibility({
            fighter: { x: fighter.x, y: fighter.y, height: CHARACTER_GAMEPLAY_HEIGHT, grounded: true },
            ball,
            kickPresses: 2,
            minimumUpwardRatio: CHILENA_FRAMED_MIN_UPWARD_RATIO,
          });
          if (ballUp < minimum) {
            expect(gate.allowed).toBe(false);
            expect(gate.reason).toBe('ball-not-overhead');
          }
          if (!gate.allowed) continue;
          eligible += 1;
          const result = planFramedChilena({
            fighter,
            ball,
            bootOffset: bootOffset(facing, contact),
            groundY: 636,
            targetSeconds: chilenaContactTargetSeconds({
              upwardDistance: gate.upwardDistance,
              height: gate.maximumDistance,
            }),
          });
          expect(result.reachable, JSON.stringify({ ballDx, ballUp, facing })).toBe(true);
        }
      }
    }
    expect(eligible).toBeGreaterThan(400);
  });

  it.each(CHARACTERS.map(({ id }) => id))('meets every still ball at or above %s\'s standing contact boot', (id) => {
    // Each character's contact drawing holds the boot at a different height
    // (Mum's boot is 41 px higher than Bob's). Any still ball in the trigger
    // window that is level with or above that boot, as drawn on a standing
    // player, must connect; lower balls are left to the planner, which turns
    // an unreachable press into an ordinary kick.
    const contact = contactOf(id);
    // Boot height above the body centre (the body bottom is 70 px below it).
    const standingBootUp = -bootOffset(1, contact).y - 70;
    let eligible = 0;
    for (let ballUp = Math.ceil(standingBootUp); ballUp <= 240; ballUp += 2) {
      for (let ballDx = -108; ballDx <= 108; ballDx += 6) {
        for (const facing of [-1, 1]) {
          const result = plan({ ballDx, ballUp, facing, contact });
          if (!result) continue;
          eligible += 1;
          expect(result, JSON.stringify({ id, ballDx, ballUp, facing })).toMatchObject({ reachable: true });
          expect(result.surfaceDistance).toBeLessThanOrEqual(CHILENA_FORGIVE_RADIUS);
          expect(result.contactSeconds).toBeLessThanOrEqual(CHILENA_GUIDE_MAX_SECONDS);
        }
      }
    }
    expect(eligible, id).toBeGreaterThan(400);
  });
});

describe('installed roster atlases', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const readMeasures = (id) => JSON.parse(readFileSync(
    `${root}source-assets/sprite-pipeline/${id}/atlas/player-${id}-sheet.json`,
    'utf8',
  ));
  // Lossless WebP (VP8L): 14-bit width-1 and height-1 after the 0x2f signature.
  const webpSize = (file) => {
    const bytes = readFileSync(file);
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 16)).toBe('WEBPVP8L');
    expect(bytes[20]).toBe(0x2f);
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  };
  const pngSize = (file) => {
    const bytes = readFileSync(file);
    expect(bytes.toString('ascii', 12, 16)).toBe('IHDR');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  };

  it.each(CHARACTERS.map(({ id }) => id))('ships %s\'s versioned sheet, master and portrait', (id) => {
    const character = getCharacter(id);
    expect(character.sheetAsset).toMatch(new RegExp(`^player-${id}-sheet-v\\d+\\.webp$`));
    const sheet = `${root}public/assets/${character.sheetAsset}`;
    expect(existsSync(sheet), sheet).toBe(true);
    // 6 x 4 cells of the roster-v2 layout.
    expect(webpSize(sheet)).toEqual({ width: v2.frameWidth * 6, height: v2.frameHeight * 4 });
    const master = `${root}source-assets/animation/final/${character.sheetAsset.replace(/\.webp$/, '.png')}`;
    expect(existsSync(master), master).toBe(true);
    expect(pngSize(master)).toEqual({ width: v2.frameWidth * 6, height: v2.frameHeight * 4 });
    const portrait = `${root}public/assets/${character.portraitAsset}`;
    expect(existsSync(portrait), portrait).toBe(true);
    expect(pngSize(portrait)).toEqual({ width: 512, height: 512 });
  });

  it.each(CHARACTERS.map(({ id }) => id))('uses %s\'s measured kickReach, chilena boot and idle height', (id) => {
    const character = getCharacter(id);
    const measures = readMeasures(id);
    expect(measures).toMatchObject({
      layout: character.atlasLayout,
      cellWidth: v2.frameWidth,
      cellHeight: v2.frameHeight,
      groundY: CHARACTER_GROUND_ANCHOR_Y,
    });
    expect(character.kickReach).toBe(measures.kickReach);
    expect(character.chilenaContact).toEqual(measures.chilenaContact);
    // The fixed head collider must sit within 4 world px of the idle drawing's
    // top (the collision-coverage audit tolerance).
    const idleTopWorld = measures.idleHeight * (280 / v2.frameHeight);
    expect(Math.abs(getFootballCollisionGeometry(character).headTop - idleTopWorld), id).toBeLessThanOrEqual(4);
  });
});
