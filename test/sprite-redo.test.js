import { describe, expect, it } from 'vitest';
import {
  CHARACTER_FRAMES,
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
  CHILENA_APEX_TOLERANCE,
  CHILENA_BODY_HALF_WIDTH,
  CHILENA_CONTACT_MAX_SECONDS,
  CHILENA_CONTACT_MIN_SECONDS,
  CHILENA_CONTACT_SLOP,
  CHILENA_FORGIVE_RADIUS,
  CHILENA_GUIDE_MAX_SECONDS,
  CHILENA_TAKEOFF_VELOCITY,
  chilenaContactTargetSeconds,
  chilenaFlightLimits,
  evaluateFramedChilenaEligibility,
  framedChilenaZone,
  normalJumpRise,
  planFramedChilena,
  resolveChilenaContact,
} from '../src/game/pure/chilena.js';
import { PLAYER_TUNING } from '../src/game/constants.js';
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

  // Framed chilena zone (owner decision 2026-10-12, every character): the
  // ball must be overhead (at or above head level, within a body width of the
  // body or boot) and close enough that the boot reaches it on the
  // character's ordinary jump; the flight never climbs above that jump.
  // Geometry below mirrors Fighter: body bottom on the pitch, body centre 70 px
  // above it, head top from the collision profile, boot from chilenaContact.
  const GROUND = 636;
  const BODY_BOTTOM_OFFSET = 70;
  const BODY_X = 640;
  const BODY_Y = GROUND - BODY_BOTTOM_OFFSET;
  const SCALE = 280 / 480;
  const jumpRiseOf = (id) => normalJumpRise({
    // Fighter: scaled(PLAYER_TUNING.jumpVelocity, stats.jump) = base * (0.9 + 0.1 * stat).
    launchVelocity: PLAYER_TUNING.jumpVelocity * (0.9 + 0.1 * getCharacter(id).stats.jump),
  });
  const bootOffset = (id, facing) => {
    const contact = getCharacter(id).chilenaContact;
    return {
      x: (contact.x - v2.frameWidth / 2) * SCALE * facing,
      y: (contact.y - CHARACTER_GROUND_ANCHOR_Y) * SCALE,
    };
  };
  const zoneOf = (id, facing) => framedChilenaZone({
    bodyX: BODY_X,
    bodyBottomY: GROUND,
    headTopY: GROUND - getFootballCollisionGeometry(getCharacter(id)).headTop,
    bootOffset: bootOffset(id, facing),
    jumpRise: jumpRiseOf(id),
  });
  /** Gate, then (when allowed) the forward plan with the game's caps. */
  const attempt = (id, facing, ball) => {
    const gate = evaluateFramedChilenaEligibility({
      fighter: { x: BODY_X, y: BODY_Y, grounded: true },
      ball,
      kickPresses: 2,
      zone: zoneOf(id, facing),
    });
    if (!gate.allowed) return { gate, plan: null };
    const takeoffVx = Math.min(2.4, Math.max(-2.4, (ball.x - BODY_X) * 0.025));
    const plan = planFramedChilena({
      fighter: { x: BODY_X, y: BODY_Y, vx: takeoffVx, bodyBottomOffset: BODY_BOTTOM_OFFSET },
      ball: { radius: 22, ...ball },
      bootOffset: bootOffset(id, facing),
      groundY: GROUND,
      targetSeconds: chilenaContactTargetSeconds({ upwardDistance: gate.bootRiseNeeded, height: gate.maxRise }),
      maxRise: gate.maxRise,
      maxSideTravel: gate.maxSideTravel,
      takeoffVelocityY: Math.max(
        CHILENA_TAKEOFF_VELOCITY,
        chilenaFlightLimits({ maxRise: gate.maxRise, maxSideTravel: gate.maxSideTravel }).minVy,
      ),
    });
    return { gate, plan };
  };
  const MOTIONS = [[0, 0], [2, -3], [-2, 3], [3, 0], [-3, 0], [0, -4], [0, 5], [4, 2]];
  const ids = CHARACTERS.map(({ id }) => id);

  it('replays an ordinary jump: about 80 px of rise, a little more for better jumpers', () => {
    for (const id of ids) {
      expect(jumpRiseOf(id), id).toBeGreaterThan(75);
      expect(jumpRiseOf(id), id).toBeLessThan(85);
    }
    expect(jumpRiseOf('bob')).toBeGreaterThan(jumpRiseOf('dad'));
  });

  it('caps the climb so the body cannot pass the normal jump apex, and sideways travel to half a body width', () => {
    expect(chilenaFlightLimits({ rise: 80, maxRise: 80 }).minVy).toBe(0);
    expect(chilenaFlightLimits({ rise: 90, maxRise: 80 }).minVy).toBe(0);
    // From the ground the cap is an ordinary jump's climb rate, not the old -15.
    const fromGround = chilenaFlightLimits({ rise: 0, maxRise: 80 }).minVy;
    expect(fromGround).toBeGreaterThan(-11);
    expect(fromGround).toBeLessThan(-9);
    expect(chilenaFlightLimits({ sideOffset: CHILENA_BODY_HALF_WIDTH, maxSideTravel: CHILENA_BODY_HALF_WIDTH }).maxVx)
      .toBe(0);
    expect(chilenaFlightLimits({ sideOffset: -40, maxSideTravel: CHILENA_BODY_HALF_WIDTH }).minVx).toBe(-3);
  });

  it.each(ids)('derives %s\'s zone from head, contact boot and normal jump', (id) => {
    const headTop = getFootballCollisionGeometry(getCharacter(id)).headTop;
    for (const facing of [-1, 1]) {
      const zone = zoneOf(id, facing);
      const bootUp = GROUND - zone.bootY;
      // Lowest: head level. Highest: boot at the normal apex plus a touch.
      expect(GROUND - zone.lowestBallY).toBe(headTop);
      expect(GROUND - zone.highestBallY).toBeCloseTo(bootUp + jumpRiseOf(id) + 22 + CHILENA_CONTACT_SLOP, 6);
      expect(zone.highestBallY).toBeLessThan(zone.lowestBallY);
      // Never chases a ball near the top of the screen (the scoreboard is above 160).
      expect(zone.highestBallY).toBeGreaterThan(300);
      // Within one body width of the body or the boot, never beyond it.
      expect(zone.left).toBe(Math.min(BODY_X, zone.bootX) - CHILENA_BODY_HALF_WIDTH);
      expect(zone.right).toBe(Math.max(BODY_X, zone.bootX) + CHILENA_BODY_HALF_WIDTH);
      expect(zone.right - zone.left).toBeLessThan(2 * CHILENA_BODY_HALF_WIDTH + 50);
      expect(zone.maxRise).toBe(jumpRiseOf(id));
    }
  });

  it.each(ids)('connects every chilena %s starts, with the body no higher than a normal jump', (id) => {
    const rise = jumpRiseOf(id);
    let started = 0;
    let stillInZone = 0;
    let stillStarted = 0;
    let movingInZone = 0;
    for (const facing of [-1, 1]) {
      const zone = zoneOf(id, facing);
      for (let ballY = zone.highestBallY - 6; ballY <= zone.lowestBallY + 6; ballY += 3) {
        for (let ballX = zone.left - 12; ballX <= zone.right + 12; ballX += 4) {
          for (const [vx, vy] of MOTIONS) {
            const ball = { x: ballX, y: ballY, vx, vy };
            const { gate, plan } = attempt(id, facing, ball);
            const inside = ballY <= zone.lowestBallY && ballY >= zone.highestBallY
              && ballX >= zone.left && ballX <= zone.right;
            expect(gate.allowed, JSON.stringify({ id, facing, ball })).toBe(inside);
            if (!inside) continue;
            if (vx === 0 && vy === 0) stillInZone += 1;
            else movingInZone += 1;
            const label = JSON.stringify({ id, facing, ball, plan });
            // (d) The whole move, contact and fall included, stays inside an
            // ordinary jump, and sideways inside half a body width.
            expect(plan.apexRise, label).toBeLessThanOrEqual(rise + CHILENA_APEX_TOLERANCE);
            expect(plan.sideTravel, label).toBeLessThanOrEqual(CHILENA_BODY_HALF_WIDTH + 0.5);
            if (!plan.reachable) continue;
            // (a) A started chilena connects: the boot touches the ball.
            started += 1;
            if (vx === 0 && vy === 0) stillStarted += 1;
            expect(plan.surfaceDistance, label).toBeLessThanOrEqual(CHILENA_FORGIVE_RADIUS);
            expect(plan.contactSeconds, label).toBeLessThanOrEqual(CHILENA_GUIDE_MAX_SECONDS);
          }
        }
      }
    }
    // Every still ball in the zone is reachable: the zone is honest.
    expect(stillInZone, id).toBeGreaterThan(400);
    expect(stillStarted, id).toBe(stillInZone);
    // Moving balls are planned; most of them still connect.
    expect(started - stillStarted, id).toBeGreaterThan(0.85 * movingInZone);
  });

  it.each(ids)('refuses %s\'s balls below the head, too high, or too far sideways', (id) => {
    for (const facing of [-1, 1]) {
      const zone = zoneOf(id, facing);
      const middleX = (zone.left + zone.right) / 2;
      const middleY = (zone.lowestBallY + zone.highestBallY) / 2;
      for (const [vx, vy] of MOTIONS) {
        // (b) Below head level: chest-high, shoulder-high, just under the head top.
        for (const below of [1, 10, 40, 80]) {
          expect(attempt(id, facing, { x: middleX, y: zone.lowestBallY + below, vx, vy }).gate.reason)
            .toBe('ball-not-overhead');
        }
        // (c) Beyond the boot's normal-jump reach, up to the top of the screen.
        for (const above of [1, 10, 40, 120]) {
          expect(attempt(id, facing, { x: middleX, y: zone.highestBallY - above, vx, vy }).gate.reason)
            .toBe('ball-too-high-or-far');
        }
        for (const ballY of [120, 180, 240]) {
          expect(attempt(id, facing, { x: BODY_X, y: ballY, vx, vy }).gate.allowed).toBe(false);
        }
        // (c) Too far sideways at an otherwise ideal height.
        for (const beyond of [1, 20, 60]) {
          expect(attempt(id, facing, { x: zone.left - beyond, y: middleY, vx, vy }).gate.reason)
            .toBe('ball-too-far-sideways');
          expect(attempt(id, facing, { x: zone.right + beyond, y: middleY, vx, vy }).gate.reason)
            .toBe('ball-too-far-sideways');
        }
      }
    }
  });

  it('would no longer fly to a high ball even if the planner were asked to', () => {
    // A ball hanging near the top of the screen (y = 200, at the top of its
    // arc). The capped flight cannot get the boot there and never climbs past
    // the normal jump; the old uncapped guidance chased it.
    const rise = jumpRiseOf('bob');
    const ball = { x: BODY_X - 20, y: 200, vx: 0, vy: 0, radius: 22 };
    const plan = planFramedChilena({
      fighter: { x: BODY_X, y: BODY_Y, bodyBottomOffset: BODY_BOTTOM_OFFSET },
      ball,
      bootOffset: bootOffset('bob', -1),
      groundY: GROUND,
      targetSeconds: CHILENA_CONTACT_MAX_SECONDS,
      maxRise: rise,
      maxSideTravel: CHILENA_BODY_HALF_WIDTH,
    });
    expect(plan.reachable).toBe(false);
    expect(plan.apexRise).toBeLessThanOrEqual(rise + CHILENA_APEX_TOLERANCE);
    // Uncapped (the old guidance), the same plan reaches it by climbing
    // more than three times as high as an ordinary jump.
    const uncapped = planFramedChilena({
      fighter: { x: BODY_X, y: BODY_Y, bodyBottomOffset: BODY_BOTTOM_OFFSET },
      ball,
      bootOffset: bootOffset('bob', -1),
      groundY: GROUND,
      targetSeconds: CHILENA_CONTACT_MAX_SECONDS,
    });
    expect(uncapped.reachable).toBe(true);
    expect(uncapped.apexRise).toBeGreaterThan(3 * rise);
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
