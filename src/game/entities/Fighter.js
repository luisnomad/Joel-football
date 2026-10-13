import Phaser from 'phaser';
import {
  BALL_RADIUS,
  CATEGORIES,
  CROSSBAR_Y,
  DEFAULT_STATS,
  GOAL_LINE_LEFT,
  GOAL_LINE_RIGHT,
  GROUND_Y,
  PLAYER_TUNING,
} from '../constants.js';
import {
  circleIntersectsCapsule,
  createForwardStrikeCapsule,
  resolveAdaptiveLob,
} from '../pure/gameplayPhysics.js';
import { DEFAULT_KICK_REACH } from '../content/characters.js';
import { getFootballCollisionGeometry } from '../content/characterCollisionProfiles.js';
import {
  getSpriteSourcePointWorldPosition,
  syncCharacterVisual,
} from './CharacterVisualRig.js';
import { resolveFacing } from '../pure/facing.js';
import {
  BIG_GUY_TRANSITION,
  activateBigGuy,
  createBigGuyState,
  stepBigGuy,
} from '../pure/bigGuy.js';
import { armPower, chargeMeter } from '../pure/power.js';
import { FighterStatusEffects } from '../effects/FighterStatusEffects.js';
import { addKickBoostTaps, kickBoostMultipliers, resolveKickBoost } from '../pure/kickBoost.js';
import {
  CHARACTER_GROUND_ANCHOR_Y,
  CHARACTER_DISPLAY_HEIGHT,
  CHARACTER_GAMEPLAY_HEIGHT,
  CHARACTER_FRAMES,
  ENHANCED_CHARACTER_FRAME_COUNT,
  KICK_STRIKE_WINDOW_END,
  KICK_VISUAL_SECONDS,
  LANDING_SQUASH_MIN_VELOCITY,
  LAND_SQUASH_SECONDS,
  RUN_FRAME_DISTANCE,
  TAKEOFF_STRETCH_MIN_VELOCITY,
  TAKEOFF_STRETCH_SECONDS,
  celebrateVisualAt,
  chilenaVisualAt,
  getCharacterLayout,
  hitVisualAt,
  idleVisualAt,
  isLayoutGroundedFrame,
  kickVisualAt,
  layoutDisplayWidth,
  layoutKickVisualAt,
  layoutRunVisualAt,
  runCycleAdvance,
  runVisualAt,
  secondaryMotionAt,
  sprintVisualAt,
} from '../pure/characterAnimation.js';
import {
  CHILENA_BODY_HALF_WIDTH,
  CHILENA_MAX_SECONDS,
  CHILENA_MIN_AIRTIME_SECONDS,
  CHILENA_MIN_UPWARD_RATIO,
  CHILENA_REQUIRED_KICK_PRESSES,
  CHILENA_TAKEOFF_VELOCITY,
  chilenaContactTargetSeconds,
  chilenaFlightLimits,
  chilenaGuidanceVelocity,
  chilenaSurfaceDistance,
  evaluateChilenaEligibility,
  evaluateFramedChilenaEligibility,
  framedChilenaZone,
  normalJumpRise,
  planFramedChilena,
  resolveChilenaContact,
  chilenaRotationAt,
  resolveChilenaShot,
  resolveLobChilenaLaunch,
  resolveLobChilenaRiseSpeed,
} from '../pure/chilena.js';
import { SUPERPOWER_ACTIVE_SECONDS } from '../content/superpowers.js';

const scaled = (base, stat) => base * (0.9 + stat * 0.1);

/**
 * Seconds after a framed chilena's contact before the body collides with the
 * ball again. The physics body stays upright while the drawing lies
 * horizontal, so the upright head cap occupies the space the boot strikes in.
 */
const CHILENA_BALL_PASS_SECONDS = 0.2;

export class Fighter {
  constructor(scene, {
    id,
    side,
    x,
    texture,
    textureFacing,
    name,
    stats = DEFAULT_STATS,
    visualScale = 1,
    kickReach = 0,
    frameScales = null,
    character = null,
  }) {
    this.scene = scene;
    this.id = id;
    this.side = side;
    this.name = name;
    this.stats = { ...DEFAULT_STATS, ...stats };
    /**
     * Body rise (px) of this character's ordinary jump (no Hyper boost). The
     * framed chilena never lifts the body higher than this.
     */
    this.normalJumpRise = normalJumpRise({
      launchVelocity: scaled(PLAYER_TUNING.jumpVelocity, this.stats.jump),
    });
    this.visualScale = Phaser.Math.Clamp(Number(visualScale) || 1, 0.85, 1.2);
    /** Boot-tip distance used for the strike capsule; see getCharacterKickReach. */
    this.kickReach = kickReach > 0 ? kickReach : DEFAULT_KICK_REACH;
    /** Per-frame display enlargement for pipeline-shrunk drawings (or null). */
    this.frameScales = frameScales;
    this.character = character;
    /** Atlas layout (classic 12-frame or the sprite-redo roster-v2). */
    this.layout = getCharacterLayout(character);
    /** Source-cell boot point on the chilena contact drawing (framed layouts). */
    this.chilenaContactPoint = character?.chilenaContact ?? null;
    this.facing = side === 'left' ? 1 : -1;
    this.baseFacing = this.facing;
    this.textureFacing = textureFacing === -1 ? -1 : 1;
    this.meter = 0;
    this.kickTimer = 0;
    this.kickCooldown = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirection = 0;
    this.stunTimer = 0;
    this.stunProtection = 0;
    this.powerArmed = 0;
    this.jumpCounterWindow = 0;
    this.kickSerial = 0;
    this.ballHitSerial = -1;
    this.combatHitSerial = -1;
    this.shotType = 'drive';
    this.kickBoostTaps = 0;
    this.kickBoostAppliedTaps = 0;
    this.kickBoostAppliedStrength = 0;
    this.lastKickBoostSpent = 0;
    this.lastStrikePowered = false;
    this.pendingShotRestart = null;
    this.lastChilenaAttempt = null;
    this.chilenaActive = false;
    this.chilenaElapsed = 0;
    this.chilenaSuccesses = 0;
    this.shieldTimer = 0;
    this.shieldBlockCooldown = 0;
    this.hyperTimer = 0;
    this.freezeTimer = 0;
    this.bigGuy = createBigGuyState();
    this.bigGuyGroundPin = false;
    this.runCycle = 0;
    this.lastRunFrame = 0;
    this.lastAnimationX = x;
    this.currentRunPhase = null;
    this.currentAnimationStage = 'idle';
    this.visualOffsetY = 0;
    this.currentPose = 'idle';
    this.landSquashTimer = 0;
    this.takeoffStretchTimer = 0;
    this.kickVisualTimer = 0;
    this.prevGrounded = true;
    this.prevVelocityY = 0;
    this.chilenaAngle = 0;
    // Framed chilena: the shot waits for the boot to meet the ball.
    this.chilenaPendingShot = null;
    this.chilenaContactAt = null;
    this.chilenaTargetSeconds = 0;
    this.chilenaMissed = false;
    this.chilenaPreviousGap = null;
    /** Takeoff point and caps of the framed chilena in flight. */
    this.chilenaFlight = null;
    this.lastChilenaContact = null;
    this.celebrating = false;
    /** Game-time seconds for authored loops (idle, celebrate); fixed-step, not wall clock. */
    this.animationClock = 0;

    const collisionGeometry = getFootballCollisionGeometry(character);
    this.collisionProfile = character?.collisionProfile ?? 'standard';
    this.collisionScale = collisionGeometry.bodyScale;
    const { Bodies, Body } = Phaser.Physics.Matter.Matter;
    const head = Bodies.circle(0, -52, 43, {
      label: `${id}:head`,
      restitution: 0.1,
      friction: 0.15,
    });
    const headCap = Bodies.circle(0, collisionGeometry.headCapY, 40, {
      label: `${id}:head`,
      restitution: 0.1,
      friction: 0.15,
      density: 0.000001,
    });
    const torso = Bodies.rectangle(0, 27, 50, 64, {
      label: `${id}:body`,
      chamfer: { radius: 14 },
      restitution: 0.04,
      friction: 0.5,
    });
    const foot = Bodies.rectangle(0, 63, 46, 14, {
      label: `${id}:foot`,
      chamfer: { radius: 6 },
      restitution: 0.05,
      friction: 0.7,
    });
    const compound = Body.create({
      label: `${id}:player`,
      parts: [head, headCap, torso, foot],
      friction: 0.2,
      frictionAir: 0.018,
      restitution: 0.02,
      inertia: Infinity,
    });

    this.sprite = scene.add.sprite(x, GROUND_Y - 89, texture, 0);
    this.hasPoseSheet = this.sprite.texture.frameTotal >= 6;
    this.hasEnhancedPoseSheet = this.sprite.texture.frameTotal >= ENHANCED_CHARACTER_FRAME_COUNT;
    this.sprite.setDisplaySize(
      (this.hasPoseSheet ? layoutDisplayWidth(this.layout) : 205) * this.visualScale,
      (this.hasPoseSheet ? CHARACTER_DISPLAY_HEIGHT : 205) * this.visualScale,
    );
    this.baseSpriteScale = { x: this.sprite.scaleX, y: this.sprite.scaleY };
    this.bigGuyScale = 1;
    this.sprite.setDepth(18);
    scene.matter.add.gameObject(this.sprite, compound);
    if (this.collisionScale !== 1) {
      // Gameplay size is explicit in the collision profile. Scale around the
      // feet so deliberately larger competitors stay registered to the pitch.
      Body.scale(
        this.sprite.body,
        this.collisionScale,
        this.collisionScale,
        { x: this.sprite.body.position.x, y: this.sprite.body.bounds.max.y },
      );
      this.sprite.setFixedRotation();
    }
    this.baseBodyBottomOffset = this.sprite.body.bounds.max.y - this.sprite.body.position.y;
    this.visualGroundOriginY = this.hasEnhancedPoseSheet
      ? CHARACTER_GROUND_ANCHOR_Y - this.baseBodyBottomOffset / this.baseSpriteScale.y
      : this.sprite.height / 2;
    this.sprite.setOrigin(0.5, 0.5);
    this.placeOnGround(x);
    this.sprite.setDisplayOrigin(this.sprite.width / 2, this.visualGroundOriginY);
    this.sprite.setFlipX(this.facing !== this.textureFacing);
    this.sprite.setFixedRotation();
    this.sprite.setCollisionCategory(CATEGORIES.PLAYER);
    this.setBallCollision(true);

    // The Matter sprite is the physics body only: scaling or rotating it would
    // reshape the compound collider, so it never renders. All artwork lives on
    // a visual-only mirror sprite that copies position, frame, and flip every
    // frame and is free to squash, stretch, and lean around the shared ground
    // anchor. Chilenas deliberately switch to the torso pivot while airborne.
    this.visual = scene.add.sprite(x, GROUND_Y - this.baseBodyBottomOffset, texture, 0)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(this.sprite.displayWidth, this.sprite.displayHeight)
      .setDepth(18);
    this.visual.setDisplayOrigin(this.sprite.width / 2, this.visualGroundOriginY);
    this.visual.setFlipX(this.sprite.flipX);
    this.sprite.setVisible(false);

    this.aura = scene.add.graphics().setDepth(17);
    // Halo, ice block, shield bubble, speed lines and the Big Guy pop. Drawn as
    // shapes and baked textures because the Canvas renderer ignores tints/preFX.
    this.statusEffects = new FighterStatusEffects(scene);
    this.bigGuyPopSeconds = Infinity;
    this.statusText = scene.add.text(x, GROUND_Y - this.baseBodyBottomOffset - 118, '', {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#071426',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Matter advances from the scene update event after MatchScene has selected
    // the animation pose. Re-pin during POST_UPDATE so fast airborne moves do
    // not render one simulation tick behind their body.
    // The second sync is positioning-only: impulse envelopes are sampled once
    // in updatePose and must not be triggered twice per frame.
    this.postPhysicsVisualSync = () => {
      this.stabilizeBigGuyGroundTransition();
      this.syncVisual(false);
    };
    this.detachPostPhysicsVisualSync = () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postPhysicsVisualSync);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postPhysicsVisualSync);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.detachPostPhysicsVisualSync);
  }

  /** Player-ball body collisions (off only while a framed chilena owns the ball). */
  setBallCollision(enabled) {
    this.ballCollision = Boolean(enabled);
    this.sprite.setCollidesWith(enabled
      ? [CATEGORIES.WORLD, CATEGORIES.PLAYER, CATEGORIES.BALL, CATEGORIES.GOAL]
      : [CATEGORIES.WORLD, CATEGORIES.PLAYER, CATEGORIES.GOAL]);
  }

  get grounded() {
    const growthOffset = this.baseBodyBottomOffset * (this.bigGuyScale - 1);
    // Five pixels of tolerance beyond the body-bottom offset, as before.
    return this.sprite.y >= GROUND_Y - (this.baseBodyBottomOffset + 5) - growthOffset
      && Math.abs(this.sprite.body.velocity.y) < 1.8;
  }

  get stunned() {
    return this.stunTimer > 0 || this.freezeTimer > 0;
  }

  placeOnGround(x) {
    this.sprite.setPosition(x, GROUND_Y - this.baseBodyBottomOffset);
    // Matter updates compound bounds through the body setter. Correct against
    // the resulting bounds as well, so scaled profiles never inherit a
    // one-frame spawn offset from body construction or a future shape change.
    const groundError = GROUND_Y - this.sprite.body.bounds.max.y;
    if (Math.abs(groundError) > 0.0001) {
      this.sprite.setPosition(x, this.sprite.y + groundError);
    }
    this.sprite.setVelocity(0, 0);
  }

  reset(x, { preservePowerEffects = false } = {}) {
    const powerEffects = preservePowerEffects ? {
      shieldTimer: this.shieldTimer,
      hyperTimer: this.hyperTimer,
      freezeTimer: this.freezeTimer,
      bigGuy: this.bigGuy,
    } : null;
    this.bigGuy = createBigGuyState();
    this.bigGuyGroundPin = false;
    this.setBigGuyScale(1);
    this.placeOnGround(x);
    this.sprite.setAngularVelocity(0);
    this.kickTimer = 0;
    this.kickBoostTaps = 0;
    this.kickBoostAppliedTaps = 0;
    this.kickBoostAppliedStrength = 0;
    this.lastKickBoostSpent = 0;
    this.lastStrikePowered = false;
    this.pendingShotRestart = null;
    this.lastChilenaAttempt = null;
    this.chilenaActive = false;
    this.chilenaElapsed = 0;
    this.chilenaAngle = 0;
    this.chilenaPendingShot = null;
    this.chilenaContactAt = null;
    this.chilenaTargetSeconds = 0;
    this.chilenaMissed = false;
    this.chilenaFlight = null;
    this.celebrating = false;
    if (!this.ballCollision) this.setBallCollision(true);
    this.sprite.setAngle(0);
    this.visual.setAngle(0).setVisible(true);
    this.dashTimer = 0;
    this.dashDirection = 0;
    this.stunTimer = 0;
    this.stunProtection = 0;
    this.powerArmed = 0;
    this.jumpCounterWindow = 0;
    this.shieldTimer = 0;
    this.shieldBlockCooldown = 0;
    this.hyperTimer = 0;
    this.freezeTimer = 0;
    this.runCycle = 0;
    this.lastRunFrame = 0;
    this.lastAnimationX = x;
    this.currentRunPhase = null;
    this.currentAnimationStage = 'idle';
    this.visualOffsetY = 0;
    this.currentPose = 'idle';
    this.landSquashTimer = 0;
    this.takeoffStretchTimer = 0;
    this.kickVisualTimer = 0;
    this.prevGrounded = true;
    this.prevVelocityY = 0;
    this.setFacing(this.baseFacing);
    if (this.hasPoseSheet) {
      this.sprite.setFrame(0);
      this.visual.setFrame(0);
    }
    this.sprite.setDisplayOrigin(this.sprite.width / 2, this.visualGroundOriginY);
    this.visual.setScale(this.baseSpriteScale.x, this.baseSpriteScale.y);
    this.aura.clear();
    this.statusEffects.clear();
    this.bigGuyPopSeconds = Infinity;
    this.statusText.setVisible(false).setText('');
    if (powerEffects) {
      this.shieldTimer = powerEffects.shieldTimer;
      this.hyperTimer = powerEffects.hyperTimer;
      this.freezeTimer = powerEffects.freezeTimer;
      this.bigGuy = powerEffects.bigGuy;
      this.setBigGuyScale(this.bigGuy.scale);
      this.renderAura();
    }
  }

  update(intent, dt, opponentX) {
    this.pendingShotRestart = null;
    const animationDistance = Math.abs(this.sprite.x - this.lastAnimationX);
    this.lastAnimationX = this.sprite.x;
    this.animationClock += dt;
    const wasKicking = this.kickTimer > 0;
    this.kickTimer = Math.max(0, this.kickTimer - dt);
    if (wasKicking && this.kickTimer === 0) {
      this.kickBoostTaps = 0;
      this.kickBoostAppliedTaps = 0;
      this.kickBoostAppliedStrength = 0;
      this.lastStrikePowered = false;
    }
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    const wasDashing = this.dashTimer > 0;
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    if (wasDashing && this.dashTimer === 0) this.dashDirection = 0;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.stunProtection = Math.max(0, this.stunProtection - dt);
    this.powerArmed = Math.max(0, this.powerArmed - dt);
    this.jumpCounterWindow = Math.max(0, this.jumpCounterWindow - dt);
    this.hyperTimer = Math.max(0, this.hyperTimer - dt);
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.shieldBlockCooldown = Math.max(0, this.shieldBlockCooldown - dt);
    this.landSquashTimer = Math.max(0, this.landSquashTimer - dt);
    this.takeoffStretchTimer = Math.max(0, this.takeoffStretchTimer - dt);
    this.kickVisualTimer = Math.max(0, this.kickVisualTimer - dt);
    this.bigGuy = stepBigGuy(this.bigGuy, dt);
    this.bigGuyPopSeconds += dt;
    this.setBigGuyScale(this.bigGuy.scale);
    this.meter = chargeMeter(this.meter, PLAYER_TUNING.passiveChargePerSecond * dt, this.stats.power);

    if (this.stunned) {
      if (this.chilenaActive) this.finishChilena();
      this.updatePose();
      this.renderAura();
      return;
    }

    if (this.chilenaActive) {
      this.continueChilenaAnimation(dt);
      return;
    }

    this.setFacing(resolveFacing({
      attackDirection: this.baseFacing,
      playerX: this.sprite.x,
      opponentX,
      movement: intent.move,
      currentFacing: this.facing,
    }));

    if (intent.power) {
      const wasArmed = this.powerArmed > 0;
      const next = armPower({ meter: this.meter, stunned: this.stunned, powerArmed: this.powerArmed });
      if (next.powerArmed > this.powerArmed) {
        this.powerArmed = next.powerArmed;
        this.scene.events.emit('fighter-power-armed', this);
      } else if (!wasArmed && this.meter < 100) {
        this.scene.events.emit('fighter-power-denied', this, this.meter);
      }
      if (this.powerArmed > 0) this.startKick();
    }

    if (intent.jump && this.grounded) {
      this.bigGuyGroundPin = false;
      const hyperBoost = this.hyperTimer > 0 ? 1.18 : 1;
      this.sprite.setVelocityY(scaled(PLAYER_TUNING.jumpVelocity, this.stats.jump) * hyperBoost);
      this.jumpCounterWindow = 0.22;
      this.scene.events.emit('fighter-jump', this);
    }
    if (intent.lob && !intent.shotRestart) this.startKick('lob');
    else if (intent.kick && !intent.shotRestart) this.startKick('drive');
    if (intent.kickBoost > 0 && this.powerArmed <= 0) {
      const previousTaps = this.kickBoostTaps;
      this.kickBoostTaps = addKickBoostTaps(this.kickBoostTaps, intent.kickBoost);
      if (this.kickBoostTaps > previousTaps) {
        this.scene.events.emit('fighter-kick-boost-charged', this, this.kickBoostTaps);
      }
    }
    if (intent.shotRestart && (intent.kick || intent.lob)) {
      this.pendingShotRestart = intent.lob ? 'lob' : 'drive';
    }
    if (intent.dash || intent.dashDirection) this.startDash(intent.dashDirection || this.facing);

    const airborne = !this.grounded;
    if (airborne) {
      const fastFall = PLAYER_TUNING.fastFallAcceleration * dt * 60;
      this.sprite.setVelocityY(this.sprite.body.velocity.y + fastFall);
    }

    if (this.dashTimer > 0) {
      const hyperBoost = this.hyperTimer > 0 ? 1.2 : 1;
      this.sprite.setVelocityX(this.dashDirection * scaled(PLAYER_TUNING.dashSpeed, this.stats.dash) * hyperBoost);
    } else if (intent.move !== 0) {
      const airMultiplier = airborne ? PLAYER_TUNING.airControlMultiplier : 1;
      const hyperForce = this.hyperTimer > 0 ? 1.35 : 1;
      // Bigger colliders are heavier (Matter scales mass with area), so the
      // force grows with the character's footprint to keep acceleration equal.
      this.sprite.applyForce({
        x: intent.move * scaled(PLAYER_TUNING.moveForce, this.stats.speed)
          * ((this.collisionScale * this.bigGuyScale) ** 2) * airMultiplier * hyperForce,
        y: 0,
      });
      const hyperSpeed = this.hyperTimer > 0 ? 1.25 : 1;
      const moveIntensity = Math.abs(intent.move);
      const maxSpeed = scaled(PLAYER_TUNING.maxSpeed, this.stats.speed)
        * moveIntensity
        * (airborne ? 1.08 : 1)
        * hyperSpeed;
      this.sprite.setVelocityX(Phaser.Math.Clamp(this.sprite.body.velocity.x, -maxSpeed, maxSpeed));
    } else if (this.grounded) {
      this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.82);
    }

    if (this.grounded && Math.abs(this.sprite.body.velocity.x) > 0.65) {
      if (this.hasEnhancedPoseSheet) {
        const travelled = animationDistance > RUN_FRAME_DISTANCE * 2 ? 0 : animationDistance;
        this.runCycle += runCycleAdvance(this.layout, { travelled, dt });
      } else {
        this.runCycle += dt * Math.max(7, Math.abs(this.sprite.body.velocity.x) * 1.25);
      }
    } else {
      this.runCycle = 0;
      this.lastRunFrame = 0;
    }

    this.constrainToSide();
    this.updatePose();
    this.renderAura();
  }

  /**
   * `dt` advances the authored-loop clock when the caller is not running
   * update() (goal celebration, result screen); update() advances it itself.
   */
  updatePose(dt = 0) {
    this.animationClock += Math.max(0, Number(dt) || 0);
    if (!this.hasPoseSheet) {
      this.syncVisual();
      return;
    }
    if (!this.hasEnhancedPoseSheet) {
      this.updateLegacyPose();
      return;
    }
    // Atlas-layout driven: classic sheets resolve exactly the frames they always
    // did; roster-v2 sheets play their authored loops and framed chilena.
    const layout = this.layout;
    const clockSeconds = this.animationClock;
    let frame = layout.idle[0];
    let pose = 'idle';
    let stage = 'idle';
    this.currentRunPhase = null;
    if (this.stunned) {
      pose = 'stun';
      if (this.stunTimer > 0) {
        // Hit reaction: impact on the blow, stagger, then recover before the end.
        const hit = hitVisualAt(layout, {
          elapsed: Math.max(0, (this.stunTotal ?? this.stunTimer) - this.stunTimer),
          remaining: this.stunTimer,
        });
        frame = hit.frame;
        stage = hit.stage === 'stun' ? 'idle' : hit.stage;
      } else {
        // Frozen (ice power): hold the stagger drawing, no blow and no recovery.
        frame = layout.hit?.stagger ?? layout.stun;
      }
    } else if (this.chilenaActive) {
      pose = 'chilena';
      if (layout.chilenaFramed) {
        const chilenaVisual = chilenaVisualAt(layout, {
          contactAt: this.chilenaContactAt,
          elapsed: this.chilenaElapsed,
          contactReady: this.chilenaMissed,
        });
        frame = chilenaVisual.frame;
        stage = `chilena-${chilenaVisual.stage}`;
      } else {
        frame = layout.chilena.contact;
      }
    } else if (this.dashTimer > 0) {
      const sprint = sprintVisualAt(layout, PLAYER_TUNING.dashDuration - this.dashTimer);
      frame = sprint?.frame ?? layout.dash;
      pose = 'dash';
      if (sprint) stage = sprint.stage;
    } else if (this.kickVisualTimer > 0) {
      // The visual timeline outlives the gameplay kick so the follow-through
      // can play out; the strike itself still connects immediately.
      const kickVisual = layoutKickVisualAt(layout, {
        remaining: this.kickVisualTimer,
        duration: KICK_VISUAL_SECONDS,
      });
      frame = kickVisual.frame;
      stage = kickVisual.stage;
      pose = this.shotType === 'lob' ? 'lob' : 'kick';
    } else if (!this.grounded) {
      frame = layout.jump;
      pose = 'jump';
    } else if (Math.abs(this.sprite.body.velocity.x) > 0.65) {
      const runVisual = layoutRunVisualAt(layout, this.runCycle);
      frame = runVisual.frame;
      pose = runVisual.pose;
      stage = runVisual.stage;
      this.currentRunPhase = runVisual.phase;
      if (runVisual.phase !== this.lastRunFrame) {
        this.lastRunFrame = runVisual.phase;
        if (runVisual.footstep) this.scene.events.emit('fighter-step', this);
      }
    } else if (this.celebrating && layout.celebrate.length > 1) {
      frame = celebrateVisualAt(layout, clockSeconds).frame;
      pose = 'celebrate';
      stage = 'celebrate';
    } else {
      frame = idleVisualAt(layout, clockSeconds).frame;
    }
    this.currentPose = pose;
    this.currentAnimationStage = stage;
    this.sprite.setFrame(frame);
    this.syncVisual();
  }

  /** Goal / win celebration loop while standing still (layouts that author one). */
  setCelebrating(active) {
    this.celebrating = Boolean(active);
  }

  /** Pose selection for pre-atlas sheets (6-11 frames): legacy run and kick only. */
  updateLegacyPose() {
    let frame = CHARACTER_FRAMES.idle;
    this.currentRunPhase = null;
    this.currentAnimationStage = 'idle';
    if (this.stunned) frame = CHARACTER_FRAMES.stun;
    else if (this.chilenaActive) frame = CHARACTER_FRAMES.legacyKick;
    else if (this.dashTimer > 0) frame = CHARACTER_FRAMES.dash;
    else if (this.kickVisualTimer > 0) {
      if (this.hasEnhancedPoseSheet) {
        // The visual timeline outlives the gameplay kick so the follow-through
        // can play out; the strike itself still connects immediately.
        const kickVisual = kickVisualAt({
          remaining: this.kickVisualTimer,
          duration: KICK_VISUAL_SECONDS,
        });
        frame = kickVisual.frame;
        this.currentAnimationStage = kickVisual.stage;
      } else {
        frame = CHARACTER_FRAMES.legacyKick;
        this.currentAnimationStage = 'contact';
      }
    } else if (!this.grounded) frame = CHARACTER_FRAMES.jump;
    else if (Math.abs(this.sprite.body.velocity.x) > 0.65) {
      if (this.hasEnhancedPoseSheet) {
        const runVisual = runVisualAt(this.runCycle);
        frame = runVisual.frame;
        this.currentPose = runVisual.pose;
        this.currentRunPhase = runVisual.phase;
        this.currentAnimationStage = runVisual.stage;
        if (runVisual.phase !== this.lastRunFrame) {
          this.lastRunFrame = runVisual.phase;
          if (runVisual.footstep) this.scene.events.emit('fighter-step', this);
        }
      } else {
        const stridePhase = Math.floor(this.runCycle) % 2;
        frame = stridePhase === 0 ? CHARACTER_FRAMES.legacyRun : CHARACTER_FRAMES.idle;
        this.currentPose = stridePhase === 0 ? 'run-stride' : 'run-contact';
        this.currentAnimationStage = this.currentPose;
        if (stridePhase !== this.lastRunFrame) {
          this.lastRunFrame = stridePhase;
          this.scene.events.emit('fighter-step', this);
        }
      }
    }
    if (this.chilenaActive) this.currentPose = 'chilena';
    else if (frame === CHARACTER_FRAMES.idle && Math.abs(this.sprite.body.velocity.x) <= 0.65) this.currentPose = 'idle';
    else if (frame === CHARACTER_FRAMES.jump) this.currentPose = 'jump';
    else if (frame === CHARACTER_FRAMES.legacyKick
      || frame === CHARACTER_FRAMES.kickAnticipation
      || frame === CHARACTER_FRAMES.kickContact
      || frame === CHARACTER_FRAMES.kickRecovery) {
      this.currentPose = this.shotType === 'lob' ? 'lob' : 'kick';
    } else if (frame === CHARACTER_FRAMES.dash) this.currentPose = 'dash';
    else if (frame === CHARACTER_FRAMES.stun) this.currentPose = 'stun';
    this.sprite.setFrame(frame);
    this.syncVisual();
  }

  /**
   * Mirrors the physics body onto the visual-only sprite and layers the
   * procedural accent motion (breathing, run plant dips, dash lean, stun
   * wobble, landing squash, takeoff stretch) on top. The Matter sprite itself
   * is never scaled or rotated, so the collider stays untouched. Scaling
   * pivots on the shared ground anchor, keeping planted feet planted.
   */
  syncVisual(trackTransitions = true) {
    const grounded = this.grounded;
    const velocityY = this.sprite.body.velocity.y;
    if (trackTransitions) {
      if (!this.prevGrounded && grounded && this.prevVelocityY > LANDING_SQUASH_MIN_VELOCITY) {
        this.landSquashTimer = LAND_SQUASH_SECONDS;
      }
      if (this.prevGrounded && !grounded && velocityY < TAKEOFF_STRETCH_MIN_VELOCITY) {
        this.takeoffStretchTimer = TAKEOFF_STRETCH_SECONDS;
      }
      this.prevGrounded = grounded;
      this.prevVelocityY = velocityY;
    }

    // Ease the impulse envelopes so they punch in and settle smoothly. A
    // framed chilena is drawn unscaled: its contact drawing's boot is the
    // gameplay boot, and capped (normal-jump) chilenas often meet the ball
    // while the takeoff stretch would still be running.
    const framedChilena = this.chilenaActive && this.layout.chilenaFramed;
    const landSquash = framedChilena ? 0 : (this.landSquashTimer / LAND_SQUASH_SECONDS) ** 2;
    const takeoffStretch = framedChilena ? 0 : (this.takeoffStretchTimer / TAKEOFF_STRETCH_SECONDS) ** 2;
    const motion = secondaryMotionAt({
      pose: this.currentPose,
      stage: this.currentAnimationStage,
      runCycle: this.runCycle,
      clockSeconds: this.scene.time.now / 1000,
      landSquash,
      takeoffStretch,
      dashDirection: this.dashTimer > 0 ? this.dashDirection : 0,
      dashLeanDegrees: this.layout.sprintLeanDegrees ?? null,
      chilena: this.chilenaActive,
    });
    // Pipeline-shrunk drawings (wide action poses) get their display-time
    // enlargement; the capsule mirrors it via the contact frame's factor.
    const frameBoost = this.frameScales?.[Number(this.sprite.frame.name)] ?? 1;
    // Framed chilenas carry the body orientation in the drawings and keep the
    // ordinary ground anchor; only the classic single drawing is spun.
    const rotatingAirborne = this.chilenaActive && !this.layout.chilenaFramed;
    syncCharacterVisual({
      physicsSprite: this.sprite,
      visualSprite: this.visual,
      scaleX: this.baseSpriteScale.x * this.bigGuyScale * frameBoost * motion.scaleX,
      scaleY: this.baseSpriteScale.y * this.bigGuyScale * frameBoost * motion.scaleY,
      angle: rotatingAirborne ? this.chilenaAngle : motion.angle,
      // Grounded and ordinary airborne poses register the authored support
      // foot. A chilena is different: keeping that foot fixed while rotating
      // translates the whole body around it and through the pitch. Pin the
      // sprite's display origin (authored near the torso) to the physics-body
      // center so the artwork rotates around its mass while the body rises.
      sourceAnchorX: rotatingAirborne ? this.visual.displayOriginX : this.visual.width / 2,
      sourceAnchorY: rotatingAirborne ? this.visual.displayOriginY : CHARACTER_GROUND_ANCHOR_Y,
      targetAnchorX: this.sprite.x,
      targetAnchorY: rotatingAirborne
        ? this.sprite.y
        : grounded ? GROUND_Y : this.sprite.body.bounds.max.y,
    });
    // Ground registration belongs to the atlas. No vertical display offset:
    // even a one-pixel bob makes planted shoes visibly cross the pitch.
    this.visualOffsetY = 0;
  }

  startKick(shotType = 'drive', {
    force = false,
    preserveBoost = false,
    markAlreadyHit = false,
  } = {}) {
    if ((!force && this.kickCooldown > 0) || this.stunned) return false;
    this.shotType = shotType;
    if (!preserveBoost) {
      this.kickBoostTaps = 0;
      this.kickBoostAppliedTaps = 0;
      this.kickBoostAppliedStrength = 0;
      this.lastKickBoostSpent = 0;
    }
    this.lastStrikePowered = false;
    this.kickTimer = PLAYER_TUNING.kickDuration;
    this.kickVisualTimer = KICK_VISUAL_SECONDS;
    this.kickCooldown = PLAYER_TUNING.kickCooldown;
    this.kickSerial += 1;
    if (markAlreadyHit) this.ballHitSerial = this.kickSerial;
    this.scene.events.emit('fighter-kick', this, this.powerArmed > 0);
    return true;
  }

  restartPendingShot() {
    const shotType = this.pendingShotRestart;
    this.pendingShotRestart = null;
    if (!shotType) return false;
    const currentShotAlreadyHit = this.ballHitSerial === this.kickSerial;
    return this.startKick(shotType, {
      force: true,
      preserveBoost: true,
      // A connected kick already receives the queued post-contact boost before
      // this restart. Do not double-strike the same ball from that one press;
      // the fresh serial still restarts the animation and cooldown immediately.
      markAlreadyHit: currentShotAlreadyHit,
    });
  }

  startDash(direction = this.facing) {
    if (this.dashCooldown > 0 || this.stunned) return false;
    this.dashDirection = Math.sign(direction) || this.facing;
    this.dashTimer = PLAYER_TUNING.dashDuration;
    this.dashCooldown = scaled(PLAYER_TUNING.dashCooldown, 2 - this.stats.dash);
    this.scene.events.emit('fighter-dash', this);
    return true;
  }

  isKickContactActive() {
    if (this.kickTimer <= 0) return false;
    const progress = 1 - this.kickTimer / PLAYER_TUNING.kickDuration;
    // Strikes connect immediately on kick start (a tested gameplay contract:
    // the kick-boost taps rely on it) and close early in the follow-through.
    return progress >= 0 && progress <= KICK_STRIKE_WINDOW_END;
  }

  strikeCapsule() {
    const scale = this.bigGuyScale;
    // The capsule follows the visible boot: from the body center to the
    // character's measured boot tip (including the contact frame's display
    // enlargement), with a slim radius. The old 106/44 pole reached roughly
    // two ball-widths past the artwork.
    const contactBoost = this.frameScales?.[this.layout.kickContact] ?? 1;
    return createForwardStrikeCapsule({
      x: this.sprite.x,
      y: this.sprite.y,
      facing: this.facing,
      endForwardOffset: this.kickReach * contactBoost * scale,
      verticalOffset: 28 * scale,
      radius: PLAYER_TUNING.strikeCapsuleRadius * scale,
    });
  }

  attemptBallStrike(ball, opponent = null) {
    if (this.kickTimer <= 0 || this.ballHitSerial === this.kickSerial) return null;
    const dy = ball.body.y - this.sprite.y;
    if (dy < -CHARACTER_GAMEPLAY_HEIGHT * 0.18) return null;
    if (!this.isKickContactActive() || !circleIntersectsCapsule({
      circle: { x: ball.body.x, y: ball.body.y },
      radius: ball.radius,
      ...this.strikeCapsule(),
    })) return null;
    this.ballHitSerial = this.kickSerial;
    const powered = this.powerArmed > 0;
    const lob = this.shotType === 'lob' && !powered;
    const adaptiveLob = lob && opponent
      ? resolveAdaptiveLob({
        ballX: ball.body.x,
        ballY: ball.body.y,
        opponentX: opponent.sprite.x,
        opponentY: opponent.sprite.y,
        attackDirection: this.facing,
      })
      : null;
    const speed = powered
      ? PLAYER_TUNING.powerShotSpeed
      : scaled(adaptiveLob ? Math.abs(adaptiveLob.vx) : lob ? PLAYER_TUNING.lobSpeed : PLAYER_TUNING.kickSpeed, this.stats.kick);
    const lift = powered ? -3.8 : adaptiveLob?.vy ?? (lob ? PLAYER_TUNING.lobLift : PLAYER_TUNING.kickLift);
    const boost = powered
      ? resolveKickBoost()
      : resolveKickBoost({ meter: this.meter, taps: this.kickBoostTaps, shotType: lob ? 'lob' : 'drive' });
    ball.applyStrikeVelocity(
      this.facing * speed * boost.speedMultiplier,
      lift * boost.liftMultiplier,
      { powered },
    );
    ball.applyStrikeSpin(this.facing * 0.24);
    if (powered) {
      this.meter = 0;
      this.powerArmed = 0;
    } else {
      this.meter = boost.boosted
        ? boost.meterAfter
        : chargeMeter(this.meter, PLAYER_TUNING.contactCharge, this.stats.power);
    }
    this.lastKickBoostSpent = boost.energySpent;
    this.kickBoostAppliedTaps = this.kickBoostTaps;
    this.kickBoostAppliedStrength = boost.strength;
    this.lastStrikePowered = powered;
    return {
      powered,
      owner: this.side,
      shotType: lob ? 'lob' : 'drive',
      boosted: boost.boosted,
      boostStrength: boost.strength,
      energySpent: boost.energySpent,
      targetX: adaptiveLob?.targetX ?? null,
      opponentDistance: adaptiveLob?.opponentDistance ?? null,
      predictedApexY: adaptiveLob?.predictedApexY ?? null,
      predictedClearance: adaptiveLob?.predictedClearance ?? null,
    };
  }

  /**
   * World position of the boot on the chilena contact drawing for the current
   * body position and facing (framed layouts). Every cell shares one geometry,
   * so this is valid even while the takeoff drawing is on screen.
   */
  chilenaBootPosition() {
    const offset = this.chilenaBootOffset(this.facing);
    return { x: this.sprite.x + offset.x, y: this.sprite.body.bounds.max.y + offset.y };
  }

  /** Boot point relative to (body x, body bottom) for a given facing. */
  chilenaBootOffset(facing) {
    const point = this.chilenaContactPoint;
    const scaleX = this.baseSpriteScale.x * this.bigGuyScale;
    const scaleY = this.baseSpriteScale.y * this.bigGuyScale;
    const flipSign = facing === this.textureFacing ? 1 : -1;
    return {
      x: (point.x - this.layout.frameWidth / 2) * scaleX * flipSign,
      y: (point.y - CHARACTER_GROUND_ANCHOR_Y) * scaleY,
    };
  }

  /**
   * This character's framed chilena zone for its current (grounded) body:
   * head top from the collision profile, contact boot for the chilena facing,
   * and the ordinary jump's rise. See framedChilenaZone.
   */
  framedChilenaZone() {
    const bounds = this.sprite.body.bounds;
    return framedChilenaZone({
      bodyX: this.sprite.x,
      bodyBottomY: bounds.max.y,
      headTopY: bounds.min.y,
      bootOffset: this.chilenaBootOffset(-this.baseFacing),
      jumpRise: this.normalJumpRise,
      bodyHalfWidth: CHILENA_BODY_HALF_WIDTH * this.collisionScale * this.bigGuyScale,
    });
  }

  /** Velocity caps for this tick of the framed chilena (no higher than a normal jump). */
  chilenaFlightLimits() {
    const flight = this.chilenaFlight;
    if (!flight) return undefined;
    return chilenaFlightLimits({
      rise: flight.takeoffY - this.sprite.y,
      maxRise: flight.maxRise,
      sideOffset: this.sprite.x - flight.takeoffX,
      maxSideTravel: flight.maxSideTravel,
    });
  }

  /**
   * Framed chilena in flight: steer the jump so the contact drawing's boot
   * meets the ball, and apply the shot at that moment. Returns the strike
   * result on contact (MatchScene announces it then), otherwise null.
   */
  guideFramedChilena(ball) {
    const pending = this.chilenaPendingShot;
    if (!pending || this.chilenaContactAt !== null || this.chilenaMissed) return null;
    const boot = this.chilenaBootPosition();
    const ballPoint = { x: ball.body.x, y: ball.body.y };
    const ballRadius = ball.radius ?? BALL_RADIUS;
    const outcome = resolveChilenaContact({
      boot,
      ball: ballPoint,
      ballRadius,
      elapsed: this.chilenaElapsed,
      targetSeconds: this.chilenaTargetSeconds,
      previousSurfaceDistance: this.chilenaPreviousGap,
    });
    this.chilenaPreviousGap = chilenaSurfaceDistance({ boot, ball: ballPoint, ballRadius });
    if (outcome === 'missed') {
      this.chilenaMissed = true;
      this.chilenaPendingShot = null;
      this.lastChilenaContact = { outcome, seconds: this.chilenaElapsed, boot, ball: ballPoint };
      return null;
    }
    if (outcome === 'pending') {
      const velocity = this.sprite.body.velocity;
      const next = chilenaGuidanceVelocity({
        boot,
        ball: ballPoint,
        ballVelocity: ball.body.body.velocity,
        velocity,
        secondsLeft: Math.max(1 / 60, this.chilenaTargetSeconds - this.chilenaElapsed),
        limits: this.chilenaFlightLimits(),
      });
      this.sprite.setVelocity(next.x, next.y);
      return null;
    }
    this.chilenaContactAt = this.chilenaElapsed;
    this.chilenaPendingShot = null;
    this.lastChilenaContact = {
      outcome,
      seconds: this.chilenaElapsed,
      boot,
      ball: ballPoint,
      surfaceDistance: this.chilenaPreviousGap,
    };
    const strike = this.applyChilenaShot(ball, pending.lob);
    // The pose for this tick was chosen in update() before the boot met the
    // ball; switch to the contact drawing now so it shows on the strike tick
    // instead of one tick later, when the ball is already 40+ px away.
    this.updatePose();
    return strike;
  }

  /**
   * Launch speed (before the ball's strike lift multiplier) that makes a high
   * chilena peak just above CHILENA_LOB_APEX_Y from the ball's current height.
   */
  lobChilenaRiseSpeed(ball) {
    const { gravityPerTick, frictionAir, liftScale } = ball.flightPhysics({ powered: true });
    const speed = resolveLobChilenaRiseSpeed({ ballY: ball.body.y, gravityPerTick, frictionAir });
    return speed / Math.max(0.1, liftScale);
  }

  applyChilenaShot(ball, lobChilena) {
    const targetX = this.baseFacing > 0 ? GOAL_LINE_RIGHT + 24 : GOAL_LINE_LEFT - 24;
    const targetY = (CROSSBAR_Y + GROUND_Y) / 2;
    const shot = lobChilena
      ? resolveLobChilenaLaunch({
        attackDirection: this.baseFacing,
        targetX,
        targetY,
        riseSpeed: this.lobChilenaRiseSpeed(ball),
      })
      : resolveChilenaShot({
        attackDirection: this.baseFacing,
        ballX: ball.body.x,
        ballY: ball.body.y,
        targetX,
        targetY,
      });
    this.meter = shot.meterAfter;
    ball.applyStrikeVelocity(shot.vx, shot.vy, { powered: true });
    ball.applyStrikeSpin(shot.spin);
    this.scene.events.emit('fighter-chilena', this, shot);
    return {
      owner: this.side,
      shotType: lobChilena ? 'chilena-lob' : 'chilena',
      chilenaVariant: lobChilena ? 'lob' : 'drive',
      chilena: true,
      powered: true,
      color: shot.color,
      meterAfter: shot.meterAfter,
      trajectory: shot.trajectory ?? null,
    };
  }

  attemptChilena(ball) {
    if (this.chilenaActive && this.layout.chilenaFramed) return this.guideFramedChilena(ball);
    const kickPresses = 1 + this.kickBoostTaps;
    const framed = Boolean(this.layout.chilenaFramed && this.chilenaContactPoint);
    const fighterState = {
      x: this.sprite.x,
      y: this.sprite.y,
      grounded: this.grounded,
      stunned: this.stunned,
      active: this.chilenaActive,
    };
    const ballPoint = { x: ball.body.x, y: ball.body.y };
    const eligibility = framed
      // Framed chilenas: the ball must be overhead and within the boot's reach
      // on this character's ordinary jump (framedChilenaZone).
      ? evaluateFramedChilenaEligibility({
        fighter: fighterState,
        ball: ballPoint,
        kickPresses,
        zone: this.framedChilenaZone(),
      })
      : evaluateChilenaEligibility({
        fighter: {
          ...fighterState,
          // The classic trigger zone scales with the character's body.
          height: CHARACTER_GAMEPLAY_HEIGHT * this.collisionScale * this.bigGuyScale,
        },
        ball: ballPoint,
        kickPresses,
        minimumUpwardRatio: CHILENA_MIN_UPWARD_RATIO,
      });
    if (kickPresses >= CHILENA_REQUIRED_KICK_PRESSES) {
      this.lastChilenaAttempt = eligibility;
    }
    // The repeated press is a new action. A connection made by the previous
    // kick must not suppress a valid overhead conversion on this press.
    const allowed = eligibility.allowed;
    if (!allowed) return null;
    if (framed) return this.startFramedChilena(ball, eligibility);

    const targetX = this.baseFacing > 0 ? GOAL_LINE_RIGHT + 24 : GOAL_LINE_LEFT - 24;
    const targetY = (CROSSBAR_Y + GROUND_Y) / 2;
    const lobChilena = this.shotType === 'lob';
    const shot = lobChilena
      ? resolveLobChilenaLaunch({
        attackDirection: this.baseFacing,
        targetX,
        targetY,
        riseSpeed: this.lobChilenaRiseSpeed(ball),
      })
      : resolveChilenaShot({
        attackDirection: this.baseFacing,
        ballX: ball.body.x,
        ballY: ball.body.y,
        targetX,
        targetY,
      });
    this.chilenaActive = true;
    this.bigGuyGroundPin = false;
    this.chilenaElapsed = 0;
    this.chilenaSuccesses += 1;
    this.dashTimer = 0;
    this.dashDirection = 0;
    this.kickTimer = 0;
    this.kickVisualTimer = 0;
    this.kickBoostTaps = 0;
    this.kickBoostAppliedTaps = 0;
    this.pendingShotRestart = null;
    this.powerArmed = 0;
    this.ballHitSerial = this.kickSerial;
    this.meter = shot.meterAfter;
    this.setFacing(-this.baseFacing);
    this.sprite.setAngle(0);
    this.syncChilenaVisual(0);
    this.sprite.setVelocity(
      Phaser.Math.Clamp((ball.body.x - this.sprite.x) * 0.025, -2.4, 2.4),
      CHILENA_TAKEOFF_VELOCITY,
    );
    ball.applyStrikeVelocity(shot.vx, shot.vy, { powered: true });
    ball.applyStrikeSpin(shot.spin);
    this.currentPose = 'chilena';
    this.scene.events.emit('fighter-chilena', this, shot);
    return {
      owner: this.side,
      shotType: lobChilena ? 'chilena-lob' : 'chilena',
      chilenaVariant: lobChilena ? 'lob' : 'drive',
      chilena: true,
      powered: true,
      color: shot.color,
      meterAfter: shot.meterAfter,
      trajectory: shot.trajectory ?? null,
    };
  }

  /**
   * Takeoff of a framed chilena. No shot yet: the jump is steered every tick
   * (guideFramedChilena) and the ball is struck when the boot reaches it.
   */
  startFramedChilena(ball, eligibility) {
    // Higher balls (more boot rise needed) are met later, as the player rises.
    const targetSeconds = chilenaContactTargetSeconds({
      upwardDistance: eligibility.bootRiseNeeded,
      height: eligibility.maxRise,
    });
    const flight = {
      takeoffX: this.sprite.x,
      takeoffY: this.sprite.y,
      maxRise: eligibility.maxRise,
      maxSideTravel: eligibility.maxSideTravel,
    };
    // Takeoff no faster than the flight cap allows (an ordinary jump's climb).
    const takeoffVelocityY = Math.max(
      CHILENA_TAKEOFF_VELOCITY,
      chilenaFlightLimits({ maxRise: flight.maxRise, maxSideTravel: flight.maxSideTravel }).minVy,
    );
    const takeoffVelocityX = Phaser.Math.Clamp((ball.body.x - this.sprite.x) * 0.025, -2.4, 2.4);
    // Only start a chilena that will connect: the same controller is planned
    // forward first. An unreachable ball stays an ordinary kick press.
    const ballVelocity = ball.body.body.velocity;
    const plan = planFramedChilena({
      fighter: {
        x: this.sprite.x,
        y: this.sprite.y,
        vx: takeoffVelocityX,
        bodyBottomOffset: this.sprite.body.bounds.max.y - this.sprite.y,
        frictionAir: this.sprite.body.frictionAir,
      },
      ball: {
        x: ball.body.x,
        y: ball.body.y,
        vx: ballVelocity.x,
        vy: ballVelocity.y,
        radius: ball.radius ?? BALL_RADIUS,
        frictionAir: ball.body.body.frictionAir,
      },
      bootOffset: this.chilenaBootOffset(-this.baseFacing),
      groundY: GROUND_Y,
      targetSeconds,
      maxRise: flight.maxRise,
      maxSideTravel: flight.maxSideTravel,
      takeoffVelocityY,
    });
    if (!plan.reachable) {
      this.lastChilenaAttempt = Object.freeze({ ...eligibility, allowed: false, reason: 'ball-unreachable' });
      return null;
    }
    this.chilenaActive = true;
    this.bigGuyGroundPin = false;
    this.chilenaElapsed = 0;
    this.chilenaSuccesses += 1;
    this.chilenaContactAt = null;
    this.chilenaMissed = false;
    this.lastChilenaContact = null;
    this.chilenaPreviousGap = null;
    this.chilenaTargetSeconds = targetSeconds;
    this.chilenaFlight = flight;
    this.chilenaPendingShot = { lob: this.shotType === 'lob' };
    // The drawn body lies horizontal; the upright collider must not bat the
    // ball away before (or right after) the boot strikes it.
    this.setBallCollision(false);
    this.dashTimer = 0;
    this.dashDirection = 0;
    this.kickTimer = 0;
    this.kickVisualTimer = 0;
    this.kickBoostTaps = 0;
    this.kickBoostAppliedTaps = 0;
    this.pendingShotRestart = null;
    this.powerArmed = 0;
    this.ballHitSerial = this.kickSerial;
    this.setFacing(-this.baseFacing);
    this.sprite.setAngle(0);
    this.syncChilenaVisual(0);
    this.sprite.setVelocity(takeoffVelocityX, takeoffVelocityY);
    this.currentPose = 'chilena';
    // Steer from the very first tick so short contacts are not late.
    return this.guideFramedChilena(ball);
  }

  updateChilena(dt) {
    if (this.layout.chilenaFramed) {
      this.updateFramedChilena(dt);
      return;
    }
    this.chilenaElapsed += dt;
    this.setFacing(-this.baseFacing);
    this.syncChilenaVisual(chilenaRotationAt(this.chilenaElapsed, this.baseFacing));
    if (this.chilenaElapsed > 0.2) {
      const fastFall = PLAYER_TUNING.fastFallAcceleration * 1.55 * dt * 60;
      this.sprite.setVelocityY(this.sprite.body.velocity.y + fastFall);
    }
    if (this.chilenaElapsed >= CHILENA_MAX_SECONDS && !this.grounded) {
      this.sprite.setVelocityY(Math.max(12, this.sprite.body.velocity.y));
    }
    if (this.chilenaElapsed >= CHILENA_MIN_AIRTIME_SECONDS && this.grounded) {
      this.finishChilena();
    }
  }

  updateFramedChilena(dt) {
    this.chilenaElapsed += dt;
    this.setFacing(-this.baseFacing);
    this.syncChilenaVisual(0);
    // Fall fast only once the ball has been met (or has clearly left), so the
    // guidance controls the rise.
    const resolved = this.chilenaContactAt !== null || this.chilenaMissed;
    if (!this.ballCollision && (this.chilenaMissed
      || (this.chilenaContactAt !== null && this.chilenaElapsed - this.chilenaContactAt >= CHILENA_BALL_PASS_SECONDS))) {
      this.setBallCollision(true);
    }
    if (resolved) {
      const fastFall = PLAYER_TUNING.fastFallAcceleration * 1.55 * dt * 60;
      this.sprite.setVelocityY(this.sprite.body.velocity.y + fastFall);
    }
    if (this.chilenaElapsed >= CHILENA_MAX_SECONDS && !this.grounded) {
      this.sprite.setVelocityY(Math.max(12, this.sprite.body.velocity.y));
    }
    if (resolved && this.chilenaElapsed >= CHILENA_MIN_AIRTIME_SECONDS && this.grounded) {
      this.finishChilena();
    }
  }

  continueChilenaAnimation(dt) {
    if (!this.chilenaActive) return;
    this.updateChilena(dt);
    this.constrainToSide();
    this.updatePose();
    this.renderAura();
  }

  syncChilenaVisual(angle = this.chilenaAngle) {
    // syncVisual pins the visual display origin to the Matter body center while
    // this is active. The physics collider stays upright; only the artwork
    // performs the mirrored backward rotation.
    this.chilenaAngle = angle;
  }

  finishChilena() {
    this.chilenaActive = false;
    if (!this.ballCollision) this.setBallCollision(true);
    this.chilenaPendingShot = null;
    this.chilenaContactAt = null;
    this.chilenaMissed = false;
    this.chilenaFlight = null;
    this.chilenaElapsed = 0;
    this.chilenaAngle = 0;
    this.sprite.setAngle(0);
    this.visual.setAngle(0).setVisible(true);
    this.setFacing(this.baseFacing);
  }

  applyPostStrikeBoost(ball) {
    const pendingTaps = this.kickBoostTaps - this.kickBoostAppliedTaps;
    const ballDistance = Math.hypot(ball.body.x - this.sprite.x, ball.body.y - this.sprite.y);
    if (
      pendingTaps <= 0
      || this.kickTimer <= 0
      || this.ballHitSerial !== this.kickSerial
      || this.lastStrikePowered
      || ballDistance > 220
    ) return null;

    const shotType = this.shotType === 'lob' ? 'lob' : 'drive';
    const boost = resolveKickBoost({ meter: this.meter, taps: pendingTaps, shotType });
    this.kickBoostAppliedTaps = this.kickBoostTaps;
    if (!boost.boosted) return null;

    const previous = kickBoostMultipliers(this.kickBoostAppliedStrength, shotType);
    const nextStrength = Math.min(1, this.kickBoostAppliedStrength + boost.strength);
    const next = kickBoostMultipliers(nextStrength, shotType);
    const velocity = ball.body.body.velocity;
    ball.body.setVelocity(
      velocity.x * (next.speedMultiplier / previous.speedMultiplier),
      velocity.y * (next.liftMultiplier / previous.liftMultiplier),
    );
    this.meter = boost.meterAfter;
    this.kickBoostAppliedStrength = nextStrength;
    this.lastKickBoostSpent += boost.energySpent;
    return {
      powered: false,
      owner: this.side,
      shotType,
      boosted: true,
      boostStrength: nextStrength,
      energySpent: this.lastKickBoostSpent,
      incrementalEnergySpent: boost.energySpent,
    };
  }

  canHitOpponent(opponent) {
    if (!this.isKickContactActive() || this.combatHitSerial === this.kickSerial) return false;
    return circleIntersectsCapsule({
      circle: { x: opponent.sprite.x, y: opponent.sprite.y + 5 },
      radius: 42 * opponent.collisionScale * opponent.bigGuyScale,
      ...this.strikeCapsule(),
    });
  }

  markCombatHit() {
    this.combatHitSerial = this.kickSerial;
  }

  applyStun(fromDirection, strong = false) {
    if (this.shieldTimer > 0) {
      if (this.shieldBlockCooldown <= 0) {
        this.shieldBlockCooldown = 0.16;
        this.scene.events.emit('fighter-shield-block', this);
      }
      return false;
    }
    if (this.stunProtection > 0) return false;
    this.bigGuyGroundPin = false;
    if (this.chilenaActive) this.finishChilena();
    this.stunTimer = strong ? PLAYER_TUNING.stunDuration * 1.12 : PLAYER_TUNING.stunDuration;
    /** Full length of this stun, for the hit-reaction timeline. */
    this.stunTotal = this.stunTimer;
    this.stunProtection = this.stunTimer + PLAYER_TUNING.stunProtection;
    const knockback = strong ? PLAYER_TUNING.dashKnockback : PLAYER_TUNING.kickKnockback;
    this.sprite.setVelocity(fromDirection * knockback, strong ? -4.2 : -2.8);
    return true;
  }

  applyFreeze(fromDirection, seconds = SUPERPOWER_ACTIVE_SECONDS) {
    this.bigGuyGroundPin = false;
    if (this.chilenaActive) this.finishChilena();
    this.freezeTimer = Math.max(this.freezeTimer, seconds);
    this.stunTimer = Math.max(this.stunTimer, seconds);
    this.stunProtection = Math.max(this.stunProtection, seconds + PLAYER_TUNING.stunProtection);
    if (fromDirection === 0) this.sprite.setVelocity(0, 0);
    else this.sprite.setVelocity(fromDirection * 3.2, -1.4);
  }

  grantShield(seconds = SUPERPOWER_ACTIVE_SECONDS) {
    this.shieldTimer = Math.max(this.shieldTimer, seconds);
    this.shieldBlockCooldown = 0;
  }

  activateHyper(seconds = SUPERPOWER_ACTIVE_SECONDS) {
    this.hyperTimer = Math.max(this.hyperTimer, seconds);
  }

  activateBigGuy() {
    this.bigGuy = activateBigGuy(this.bigGuy);
    this.bigGuyPopSeconds = 0;
  }

  setBigGuyScale(scale) {
    const nextScale = Phaser.Math.Clamp(Number(scale) || 1, 1, 2);
    if (Math.abs(nextScale - this.bigGuyScale) < 0.0001) return;
    const wasGrounded = this.grounded;
    const anchor = { x: this.sprite.body.position.x, y: this.sprite.body.bounds.max.y };
    this.sprite.setScale(
      this.baseSpriteScale.x * nextScale,
      this.baseSpriteScale.y * nextScale,
      anchor,
    );
    this.bigGuyScale = nextScale;
    if (wasGrounded) this.bigGuyGroundPin = true;
  }

  stabilizeBigGuyGroundTransition() {
    if (!this.bigGuyGroundPin || !this.sprite?.body) return;
    const bottomError = GROUND_Y - this.sprite.body.bounds.max.y;
    if (Math.abs(bottomError) > 0.001) {
      this.sprite.setPosition(this.sprite.x, this.sprite.y + bottomError);
    }
    this.sprite.setVelocityY(0);

    const growing = this.bigGuy.secondsRemaining > 0
      && this.bigGuy.growElapsed < BIG_GUY_TRANSITION;
    const shrinking = this.bigGuy.secondsRemaining > 0
      && this.bigGuy.secondsRemaining < BIG_GUY_TRANSITION;
    if (!growing && !shrinking) this.bigGuyGroundPin = false;
  }

  onBallContact(defensive = false) {
    this.meter = chargeMeter(
      this.meter,
      defensive ? PLAYER_TUNING.defensiveCharge : PLAYER_TUNING.contactCharge,
      this.stats.power,
    );
  }

  constrainToSide() {
    const [min, max] = [142, 1138];
    if (this.sprite.x < min) {
      this.sprite.setX(min);
      this.sprite.setVelocityX(Math.max(0, this.sprite.body.velocity.x));
    } else if (this.sprite.x > max) {
      this.sprite.setX(max);
      this.sprite.setVelocityX(Math.min(0, this.sprite.body.velocity.x));
    }
  }

  setFacing(direction) {
    if (direction === 0) return;
    this.facing = direction > 0 ? 1 : -1;
    this.sprite.setFlipX(this.facing !== this.textureFacing);
  }

  renderAura() {
    this.aura.clear();
    this.updateStatusVisuals();
    const bounds = this.sprite.body.bounds;
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerY = (bounds.min.y + bounds.max.y) / 2;
    const top = bounds.min.y;
    const bottom = bounds.max.y;
    if (this.freezeTimer > 0) {
      this.aura.fillStyle(0xc9f8ff, 0.78);
      [-44, -28, -12, 12, 28, 44].forEach((offset, index) => {
        const height = 18 + (index % 3) * 8;
        this.aura.fillTriangle(
          centerX + offset - 9,
          bottom,
          centerX + offset,
          bottom - height,
          centerX + offset + 9,
          bottom,
        );
      });
      this.aura.lineStyle(2, 0xe8fcff, 0.92);
      for (let i = 0; i < 5; i += 1) {
        const angle = this.scene.time.now * 0.0014 + (i * Math.PI * 2) / 5;
        const x = centerX + Math.cos(angle) * 54;
        const y = centerY + Math.sin(angle) * Math.max(46, (bottom - top) * 0.38);
        this.aura.lineBetween(x - 5, y, x + 5, y);
        this.aura.lineBetween(x, y - 5, x, y + 5);
      }
      this.statusText
        .setText(`❄  ${this.freezeTimer.toFixed(1)}s`)
        .setColor('#d9fbff')
        .setPosition(centerX, top - 20)
        .setVisible(true);
      return;
    }
    if (this.shieldTimer > 0) {
      this.aura.fillStyle(0x83efff, 0.82);
      [
        [bounds.min.x - 14, top + 24],
        [bounds.min.x - 18, centerY],
        [bounds.min.x - 14, bottom - 24],
        [bounds.max.x + 14, top + 24],
        [bounds.max.x + 18, centerY],
        [bounds.max.x + 14, bottom - 24],
      ].forEach(([x, y]) => {
        this.aura.fillTriangle(x, y - 9, x + 7, y, x, y + 9);
        this.aura.fillTriangle(x, y - 9, x - 7, y, x, y + 9);
      });
      this.statusText
        .setText(`◆  ${this.shieldTimer.toFixed(1)}s`)
        .setColor('#bdf9ff')
        .setPosition(centerX, top - 20)
        .setVisible(true);
      return;
    }
    if (this.hyperTimer > 0) {
      this.statusText
        .setText(`★  ${this.hyperTimer.toFixed(1)}s`)
        .setColor('#dfffd6')
        .setPosition(centerX, top - 20)
        .setVisible(true);
      return;
    }
    if (this.bigGuy.secondsRemaining > 0) {
      this.statusText
        .setText(`G  ${this.bigGuy.secondsRemaining.toFixed(1)}s`)
        .setColor('#ffe5a8')
        .setPosition(centerX, top - 20)
        .setVisible(true);
      return;
    }
    this.statusText.setVisible(false).setText('');
    if (this.stunned) {
      this.aura.fillStyle(0xffed7a, 0.9);
      for (let i = 0; i < 3; i += 1) {
        const angle = this.scene.time.now * 0.004 + (i * Math.PI * 2) / 3;
        this.aura.fillCircle(this.sprite.x + Math.cos(angle) * 38, this.sprite.y - 92 + Math.sin(angle) * 10, 5);
      }
    }
  }

  updateStatusVisuals() {
    this.statusEffects.render({
      bounds: this.sprite.body.bounds,
      clock: this.scene.time.now / 1000,
      velocityX: this.sprite.body.velocity.x,
      facing: this.facing,
      popSeconds: this.bigGuyPopSeconds,
      status: {
        freezeTimer: this.freezeTimer,
        shieldTimer: this.shieldTimer,
        hyperTimer: this.hyperTimer,
        bigGuyActive: this.bigGuy.secondsRemaining > 0 || this.bigGuyScale > 1.01,
        powerArmed: this.powerArmed,
        chilenaActive: this.chilenaActive,
        side: this.side,
      },
    });
  }

  snapshot() {
    const velocity = this.sprite.body.velocity;
    const visualFrame = this.hasPoseSheet ? Number(this.sprite.frame.name) : 0;
    const visualGroundAnchor = this.hasEnhancedPoseSheet && isLayoutGroundedFrame(this.layout, visualFrame)
      ? getSpriteSourcePointWorldPosition(
        this.visual,
        this.visual.width / 2,
        CHARACTER_GROUND_ANCHOR_Y,
      )
      : null;
    return {
      id: this.id,
      name: this.name,
      x: Math.round(this.sprite.x * 10) / 10,
      y: Math.round(this.sprite.y * 10) / 10,
      vx: Math.round(velocity.x * 100) / 100,
      vy: Math.round(velocity.y * 100) / 100,
      facing: this.facing,
      nativeFacing: this.textureFacing,
      visualFlipped: this.sprite.flipX,
      grounded: this.grounded,
      stunned: this.stunned,
      frozen: this.freezeTimer > 0,
      freezeSeconds: Math.round(this.freezeTimer * 100) / 100,
      meter: Math.round(this.meter * 10) / 10,
      kickCooldown: Math.round(this.kickCooldown * 100) / 100,
      dashCooldown: Math.round(this.dashCooldown * 100) / 100,
      dashTimer: Math.round(this.dashTimer * 100) / 100,
      dashDirection: this.dashDirection,
      kickTimer: Math.round(this.kickTimer * 100) / 100,
      kickVisualSeconds: Math.round(this.kickVisualTimer * 100) / 100,
      kickSerial: this.kickSerial,
      pendingShotRestart: this.pendingShotRestart,
      powerArmed: this.powerArmed > 0,
      kickBoostTaps: this.kickBoostTaps,
      lastKickBoostSpent: this.lastKickBoostSpent,
      chilenaActive: this.chilenaActive,
      statusVisual: this.statusEffects.debugState(),
      chilenaSeconds: Math.round(this.chilenaElapsed * 100) / 100,
      chilenaRotation: Math.round(this.chilenaAngle * 10) / 10,
      chilenaSuccesses: this.chilenaSuccesses,
      chilenaFramed: this.layout.chilenaFramed,
      normalJumpRise: Math.round(this.normalJumpRise * 10) / 10,
      ballCollision: this.ballCollision,
      chilenaPending: Boolean(this.chilenaPendingShot),
      chilenaContactSeconds: this.chilenaContactAt === null ? null : Math.round(this.chilenaContactAt * 1000) / 1000,
      chilenaTargetSeconds: Math.round(this.chilenaTargetSeconds * 1000) / 1000,
      lastChilenaContact: this.lastChilenaContact
        ? {
          outcome: this.lastChilenaContact.outcome,
          seconds: Math.round(this.lastChilenaContact.seconds * 1000) / 1000,
          bootX: Math.round(this.lastChilenaContact.boot.x * 10) / 10,
          bootY: Math.round(this.lastChilenaContact.boot.y * 10) / 10,
          ballX: Math.round(this.lastChilenaContact.ball.x * 10) / 10,
          ballY: Math.round(this.lastChilenaContact.ball.y * 10) / 10,
          surfaceDistance: this.lastChilenaContact.surfaceDistance === undefined
            ? null
            : Math.round(this.lastChilenaContact.surfaceDistance * 10) / 10,
        }
        : null,
      lastChilenaAttempt: this.lastChilenaAttempt
        ? {
          allowed: this.lastChilenaAttempt.allowed,
          reason: this.lastChilenaAttempt.reason,
          dx: Math.round(this.lastChilenaAttempt.dx * 10) / 10,
          upwardDistance: Math.round(this.lastChilenaAttempt.upwardDistance * 10) / 10,
          distance: Math.round(this.lastChilenaAttempt.distance * 10) / 10,
          maximumDistance: Math.round(this.lastChilenaAttempt.maximumDistance * 10) / 10,
        }
        : null,
      pose: this.currentPose,
      visualFrame,
      displayWidth: Math.round(this.sprite.displayWidth * 10) / 10,
      displayHeight: Math.round(this.sprite.displayHeight * 10) / 10,
      visualScale: Math.round(this.visualScale * 100) / 100,
      collisionProfile: this.collisionProfile,
      collisionScale: Math.round(this.collisionScale * 100) / 100,
      collisionWidth: Math.round(
        (this.sprite.body.bounds.max.x - this.sprite.body.bounds.min.x) * 10,
      ) / 10,
      collisionHeight: Math.round(
        (this.sprite.body.bounds.max.y - this.sprite.body.bounds.min.y) * 10,
      ) / 10,
      collisionArea: Math.round(this.sprite.body.area * 10) / 10,
      collisionTopY: Math.round(this.sprite.body.bounds.min.y * 10) / 10,
      collisionBottomY: Math.round(this.sprite.body.bounds.max.y * 10) / 10,
      enhancedAnimation: this.hasEnhancedPoseSheet,
      atlasLayout: this.layout.id,
      celebrating: this.celebrating,
      animationStage: this.currentAnimationStage,
      runPhase: this.currentRunPhase,
      visualOffsetY: Math.round(this.visualOffsetY * 100) / 100,
      visualGroundAnchorY: visualGroundAnchor === null
        ? null
        : Math.round(visualGroundAnchor.y * 10) / 10,
      shield: this.shieldTimer > 0,
      shieldSeconds: Math.round(this.shieldTimer * 100) / 100,
      statusCue: this.statusText.visible ? this.statusText.text : '',
      hyperSeconds: Math.round(this.hyperTimer * 100) / 100,
      bigGuySeconds: Math.round(this.bigGuy.secondsRemaining * 100) / 100,
      bigGuyScale: Math.round(this.bigGuyScale * 100) / 100,
    };
  }

  destroy() {
    this.detachPostPhysicsVisualSync?.();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.detachPostPhysicsVisualSync);
    this.aura.destroy();
    this.statusEffects.destroy();
    this.statusText.destroy();
    this.visual.destroy();
    this.sprite.destroy();
  }
}
