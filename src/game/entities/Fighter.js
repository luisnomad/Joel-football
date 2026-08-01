import Phaser from 'phaser';
import {
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
import { addKickBoostTaps, kickBoostMultipliers, resolveKickBoost } from '../pure/kickBoost.js';
import {
  CHARACTER_GROUND_ANCHOR_Y,
  CHARACTER_DISPLAY_HEIGHT,
  CHARACTER_DISPLAY_WIDTH,
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
  isGroundedVisualFrame,
  kickVisualAt,
  runVisualAt,
  secondaryMotionAt,
} from '../pure/characterAnimation.js';
import {
  CHILENA_MAX_SECONDS,
  CHILENA_MIN_AIRTIME_SECONDS,
  CHILENA_REQUIRED_KICK_PRESSES,
  CHILENA_TAKEOFF_VELOCITY,
  evaluateChilenaEligibility,
  chilenaRotationAt,
  resolveChilenaShot,
  resolveLobChilenaLaunch,
} from '../pure/chilena.js';
import { SUPERPOWER_ACTIVE_SECONDS } from '../content/superpowers.js';

const scaled = (base, stat) => base * (0.9 + stat * 0.1);

/** Glow pulse speed (radians per millisecond of scene time) for status effects. */
const STATUS_GLOW_PULSE_RATE = 0.018;
/** Extra glow strength added at the peak of the status pulse. */
const STATUS_GLOW_PULSE_AMPLITUDE = 0.7;
/** Base glow strength while the chilena is airborne. */
const CHILENA_GLOW_STRENGTH = 5;
/** Glow color while the chilena is airborne. */
const CHILENA_GLOW_COLOR = 0xff7b32;
/** Tint applied to the artwork while the chilena is airborne. */
const CHILENA_TINT = 0xffe1c7;

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
    this.visualScale = Phaser.Math.Clamp(Number(visualScale) || 1, 0.85, 1.2);
    /** Boot-tip distance used for the strike capsule; see getCharacterKickReach. */
    this.kickReach = kickReach > 0 ? kickReach : DEFAULT_KICK_REACH;
    /** Per-frame display enlargement for pipeline-shrunk drawings (or null). */
    this.frameScales = frameScales;
    this.character = character;
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
      (this.hasPoseSheet ? CHARACTER_DISPLAY_WIDTH : 205) * this.visualScale,
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
    this.sprite.setCollidesWith([CATEGORIES.WORLD, CATEGORIES.PLAYER, CATEGORIES.BALL, CATEGORIES.GOAL]);

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

    this.statusGlow = this.visual.preFX?.addGlow?.(0xffffff, 0, 0, false) ?? null;

    this.aura = scene.add.graphics().setDepth(17);
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
    this.visual.clearTint();
    if (this.statusGlow) this.statusGlow.outerStrength = 0;
    this.aura.clear();
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
        this.runCycle += travelled / RUN_FRAME_DISTANCE;
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

  updatePose() {
    if (!this.hasPoseSheet) {
      this.syncVisual();
      return;
    }
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

    // Ease the impulse envelopes so they punch in and settle smoothly.
    const landSquash = (this.landSquashTimer / LAND_SQUASH_SECONDS) ** 2;
    const takeoffStretch = (this.takeoffStretchTimer / TAKEOFF_STRETCH_SECONDS) ** 2;
    const motion = secondaryMotionAt({
      pose: this.currentPose,
      stage: this.currentAnimationStage,
      runCycle: this.runCycle,
      clockSeconds: this.scene.time.now / 1000,
      landSquash,
      takeoffStretch,
      dashDirection: this.dashTimer > 0 ? this.dashDirection : 0,
      chilena: this.chilenaActive,
    });
    // Pipeline-shrunk drawings (wide action poses) get their display-time
    // enlargement; the capsule mirrors it via the contact frame's factor.
    const frameBoost = this.frameScales?.[Number(this.sprite.frame.name)] ?? 1;
    const rotatingAirborne = this.chilenaActive;
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
    const contactBoost = this.frameScales?.[CHARACTER_FRAMES.kickContact] ?? 1;
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

  attemptChilena(ball) {
    const kickPresses = 1 + this.kickBoostTaps;
    const eligibility = evaluateChilenaEligibility({
      fighter: {
        x: this.sprite.x,
        y: this.sprite.y,
        // The trigger zone scales with the character: taller players (Dad,
        // Mum) get a proportionally bigger window, matching their body.
        height: CHARACTER_GAMEPLAY_HEIGHT * this.collisionScale * this.bigGuyScale,
        grounded: this.grounded,
        stunned: this.stunned,
        active: this.chilenaActive,
      },
      ball: { x: ball.body.x, y: ball.body.y },
      kickPresses,
    });
    if (kickPresses >= CHILENA_REQUIRED_KICK_PRESSES) {
      this.lastChilenaAttempt = eligibility;
    }
    // The repeated press is a new action. A connection made by the previous
    // kick must not suppress a valid overhead conversion on this press.
    const allowed = eligibility.allowed;
    if (!allowed) return null;

    const targetX = this.baseFacing > 0 ? GOAL_LINE_RIGHT + 24 : GOAL_LINE_LEFT - 24;
    const targetY = (CROSSBAR_Y + GROUND_Y) / 2;
    const lobChilena = this.shotType === 'lob';
    const shot = lobChilena
      ? resolveLobChilenaLaunch({
        attackDirection: this.baseFacing,
        targetX,
        targetY,
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

  updateChilena(dt) {
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
    let color = null;
    let tint = null;
    let strength = 0;
    if (this.freezeTimer > 0) {
      color = 0x9eeeff;
      tint = 0xcaf7ff;
      strength = 6;
    } else if (this.shieldTimer > 0) {
      color = 0x55e0ee;
      tint = 0xdcfdff;
      strength = 4.5;
    } else if (this.hyperTimer > 0) {
      color = 0x8dff70;
      tint = 0xe3ffda;
      strength = 5;
    } else if (this.bigGuy.secondsRemaining > 0 || this.bigGuyScale > 1.01) {
      color = 0xffc95c;
      strength = 3;
    } else if (this.powerArmed > 0) {
      color = this.side === 'left' ? 0x62f5ff : 0xff9b42;
      tint = this.side === 'left' ? 0xe2fdff : 0xffead8;
      strength = 4;
    } else if (this.stunned) {
      tint = 0xb5c6d9;
    }

    if (this.chilenaActive) {
      color = CHILENA_GLOW_COLOR;
      tint = CHILENA_TINT;
      strength = CHILENA_GLOW_STRENGTH;
    }

    if (this.statusGlow) {
      if (color !== null) this.statusGlow.color = color;
      this.statusGlow.outerStrength = strength > 0
        ? strength + Math.sin(this.scene.time.now * STATUS_GLOW_PULSE_RATE) * STATUS_GLOW_PULSE_AMPLITUDE
        : 0;
    }
    if (tint === null) this.visual.clearTint();
    else this.visual.setTint(tint);
  }

  snapshot() {
    const velocity = this.sprite.body.velocity;
    const visualFrame = this.hasPoseSheet ? Number(this.sprite.frame.name) : 0;
    const visualGroundAnchor = this.hasEnhancedPoseSheet && isGroundedVisualFrame(visualFrame)
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
      chilenaSeconds: Math.round(this.chilenaElapsed * 100) / 100,
      chilenaRotation: Math.round(this.chilenaAngle * 10) / 10,
      chilenaSuccesses: this.chilenaSuccesses,
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
    this.statusText.destroy();
    this.visual.destroy();
    this.sprite.destroy();
  }
}
