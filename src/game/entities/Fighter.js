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
import { resolveFacing } from '../pure/facing.js';
import { activateBigGuy, createBigGuyState, stepBigGuy } from '../pure/bigGuy.js';
import { armPower, chargeMeter } from '../pure/power.js';
import { addKickBoostTaps, kickBoostMultipliers, resolveKickBoost } from '../pure/kickBoost.js';
import { SPRINT_FORCE_MULTIPLIER, SPRINT_SPEED_MULTIPLIER } from '../pure/sprint.js';
import {
  CHARACTER_GROUND_ANCHOR_Y,
  CHARACTER_DISPLAY_HEIGHT,
  CHARACTER_DISPLAY_WIDTH,
  CHARACTER_GAMEPLAY_HEIGHT,
  CHARACTER_FRAMES,
  ENHANCED_CHARACTER_FRAME_COUNT,
  RUN_FRAME_DISTANCE,
  isGroundedVisualFrame,
  kickVisualAt,
  runVisualAt,
} from '../pure/characterAnimation.js';
import {
  CHILENA_MAX_SECONDS,
  CHILENA_MIN_AIRTIME_SECONDS,
  CHILENA_TAKEOFF_VELOCITY,
  canStartChilena,
  chilenaRotationAt,
  resolveChilenaShot,
  resolveLobChilenaLaunch,
} from '../pure/chilena.js';

const scaled = (base, stat) => base * (0.9 + stat * 0.1);

export class Fighter {
  constructor(scene, { id, side, x, texture, textureFacing, name, stats = DEFAULT_STATS }) {
    this.scene = scene;
    this.id = id;
    this.side = side;
    this.name = name;
    this.stats = { ...DEFAULT_STATS, ...stats };
    this.facing = side === 'left' ? 1 : -1;
    this.baseFacing = this.facing;
    this.textureFacing = textureFacing === -1 ? -1 : 1;
    this.meter = 0;
    this.kickTimer = 0;
    this.kickCooldown = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
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
    this.chilenaActive = false;
    this.chilenaElapsed = 0;
    this.chilenaSuccesses = 0;
    this.sprinting = false;
    this.sprintDirection = 0;
    this.sprintRequiresRelease = false;
    this.superShield = 0;
    this.hyperTimer = 0;
    this.freezeTimer = 0;
    this.bigGuy = createBigGuyState();
    this.runCycle = 0;
    this.lastRunFrame = 0;
    this.lastAnimationX = x;
    this.currentRunPhase = null;
    this.currentAnimationStage = 'idle';
    this.visualOffsetY = 0;
    this.currentPose = 'idle';

    const { Bodies, Body } = Phaser.Physics.Matter.Matter;
    const head = Bodies.circle(0, -52, 43, {
      label: `${id}:head`,
      restitution: 0.1,
      friction: 0.15,
    });
    const headCap = Bodies.circle(0, -76, 40, {
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
    const foot = Bodies.rectangle(this.facing * 17, 63, 46, 14, {
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
      this.hasPoseSheet ? CHARACTER_DISPLAY_WIDTH : 205,
      this.hasPoseSheet ? CHARACTER_DISPLAY_HEIGHT : 205,
    );
    this.baseSpriteScale = { x: this.sprite.scaleX, y: this.sprite.scaleY };
    this.visualGroundOriginY = this.hasEnhancedPoseSheet
      ? CHARACTER_GROUND_ANCHOR_Y - 89 / this.baseSpriteScale.y
      : this.sprite.height / 2;
    this.bigGuyScale = 1;
    this.sprite.setDepth(18);
    scene.matter.add.gameObject(this.sprite, compound);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setPosition(x, GROUND_Y - 89);
    this.sprite.setDisplayOrigin(this.sprite.width / 2, this.visualGroundOriginY);
    this.sprite.setFlipX(this.facing !== this.textureFacing);
    this.sprite.setFixedRotation();
    this.sprite.setCollisionCategory(CATEGORIES.PLAYER);
    this.sprite.setCollidesWith([CATEGORIES.WORLD, CATEGORIES.PLAYER, CATEGORIES.BALL, CATEGORIES.GOAL]);
    this.baseBodyBottomOffset = this.sprite.body.bounds.max.y - this.sprite.body.position.y;

    // Matter rotates the compound collider whenever its sprite rotates. Keep the
    // acrobatic artwork separate so Joel's head-and-feet body stays upright and
    // returns to the same ground height after a chilena.
    this.chilenaVisual = scene.add.sprite(x, GROUND_Y - 89, texture, 0)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(this.sprite.displayWidth, this.sprite.displayHeight)
      .setDepth(18.5)
      .setVisible(false);

    this.statusGlow = this.sprite.preFX?.addGlow?.(0xffffff, 0, 0, false) ?? null;
    this.chilenaGlow = this.chilenaVisual.preFX?.addGlow?.(0xff7b32, 0, 0, false) ?? null;

    this.aura = scene.add.graphics().setDepth(17);
  }

  get grounded() {
    const growthOffset = this.baseBodyBottomOffset * (this.bigGuyScale - 1);
    return this.sprite.y >= GROUND_Y - 94 - growthOffset && Math.abs(this.sprite.body.velocity.y) < 1.8;
  }

  get stunned() {
    return this.stunTimer > 0;
  }

  reset(x) {
    this.bigGuy = createBigGuyState();
    this.setBigGuyScale(1);
    this.sprite.setPosition(x, GROUND_Y - 89);
    this.sprite.setVelocity(0, 0);
    this.sprite.setAngularVelocity(0);
    this.kickTimer = 0;
    this.kickBoostTaps = 0;
    this.kickBoostAppliedTaps = 0;
    this.kickBoostAppliedStrength = 0;
    this.lastKickBoostSpent = 0;
    this.lastStrikePowered = false;
    this.chilenaActive = false;
    this.chilenaElapsed = 0;
    this.sprite.setAngle(0);
    this.sprite.setVisible(true);
    this.chilenaVisual.setAngle(0).setVisible(false);
    this.dashTimer = 0;
    this.stunTimer = 0;
    this.stunProtection = 0;
    this.powerArmed = 0;
    this.jumpCounterWindow = 0;
    this.superShield = 0;
    this.hyperTimer = 0;
    this.freezeTimer = 0;
    this.sprinting = false;
    this.sprintDirection = 0;
    this.sprintRequiresRelease = false;
    this.runCycle = 0;
    this.lastRunFrame = 0;
    this.lastAnimationX = x;
    this.currentRunPhase = null;
    this.currentAnimationStage = 'idle';
    this.visualOffsetY = 0;
    this.currentPose = 'idle';
    this.setFacing(this.baseFacing);
    if (this.hasPoseSheet) this.sprite.setFrame(0);
    this.sprite.setDisplayOrigin(this.sprite.width / 2, this.visualGroundOriginY);
    this.sprite.clearTint();
    if (this.statusGlow) this.statusGlow.outerStrength = 0;
    if (this.chilenaGlow) this.chilenaGlow.outerStrength = 0;
    this.aura.clear();
  }

  update(intent, dt, opponentX) {
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
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.stunProtection = Math.max(0, this.stunProtection - dt);
    this.powerArmed = Math.max(0, this.powerArmed - dt);
    this.jumpCounterWindow = Math.max(0, this.jumpCounterWindow - dt);
    this.hyperTimer = Math.max(0, this.hyperTimer - dt);
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    this.bigGuy = stepBigGuy(this.bigGuy, dt);
    this.setBigGuyScale(this.bigGuy.scale);
    this.meter = chargeMeter(this.meter, PLAYER_TUNING.passiveChargePerSecond * dt, this.stats.power);

    if (!intent.sprint) this.sprintRequiresRelease = false;

    if (this.stunned) {
      if (this.chilenaActive) this.finishChilena();
      this.stopSprint(true);
      this.updatePose();
      this.renderAura();
      return;
    }

    if (this.chilenaActive) {
      this.continueChilenaAnimation(dt);
      return;
    }

    this.updateSprint(intent);

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
      const hyperBoost = this.hyperTimer > 0 ? 1.18 : 1;
      this.sprite.setVelocityY(scaled(PLAYER_TUNING.jumpVelocity, this.stats.jump) * hyperBoost);
      this.jumpCounterWindow = 0.22;
      this.scene.events.emit('fighter-jump', this);
    }
    if (intent.lob) this.startKick('lob');
    else if (intent.kick) this.startKick('drive');
    if (intent.kickBoost > 0 && this.kickTimer > 0 && this.powerArmed <= 0) {
      const previousTaps = this.kickBoostTaps;
      this.kickBoostTaps = addKickBoostTaps(this.kickBoostTaps, intent.kickBoost);
      if (this.kickBoostTaps > previousTaps) {
        this.scene.events.emit('fighter-kick-boost-charged', this, this.kickBoostTaps);
      }
    }
    if (intent.dash) this.startDash();

    const airborne = !this.grounded;
    if (airborne) {
      const fastFall = PLAYER_TUNING.fastFallAcceleration * dt * 60;
      this.sprite.setVelocityY(this.sprite.body.velocity.y + fastFall);
    }

    if (this.dashTimer > 0) {
      const hyperBoost = this.hyperTimer > 0 ? 1.2 : 1;
      this.sprite.setVelocityX(this.facing * scaled(PLAYER_TUNING.dashSpeed, this.stats.dash) * hyperBoost);
    } else if (intent.move !== 0) {
      const airMultiplier = airborne ? PLAYER_TUNING.airControlMultiplier : 1;
      const hyperForce = this.hyperTimer > 0 ? 1.35 : 1;
      const sprintForce = this.sprinting ? SPRINT_FORCE_MULTIPLIER : 1;
      this.sprite.applyForce({
        x: intent.move * scaled(PLAYER_TUNING.moveForce, this.stats.speed) * airMultiplier * hyperForce * sprintForce,
        y: 0,
      });
      const hyperSpeed = this.hyperTimer > 0 ? 1.25 : 1;
      const sprintSpeed = this.sprinting ? SPRINT_SPEED_MULTIPLIER : 1;
      const maxSpeed = scaled(PLAYER_TUNING.maxSpeed, this.stats.speed) * (airborne ? 1.08 : 1) * hyperSpeed * sprintSpeed;
      this.sprite.setVelocityX(Phaser.Math.Clamp(this.sprite.body.velocity.x, -maxSpeed, maxSpeed));
    } else if (this.grounded) {
      this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.82);
    }

    if (this.grounded && Math.abs(this.sprite.body.velocity.x) > 0.65) {
      if (this.hasEnhancedPoseSheet) {
        const travelled = animationDistance > RUN_FRAME_DISTANCE * 2 ? 0 : animationDistance;
        this.runCycle += travelled / RUN_FRAME_DISTANCE;
      } else {
        const sprintCadence = this.sprinting ? 1.5 : 1;
        this.runCycle += dt * Math.max(7, Math.abs(this.sprite.body.velocity.x) * 1.25) * sprintCadence;
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
    if (!this.hasPoseSheet) return;
    let frame = CHARACTER_FRAMES.idle;
    this.currentRunPhase = null;
    this.currentAnimationStage = 'idle';
    if (this.stunned) frame = CHARACTER_FRAMES.stun;
    else if (this.chilenaActive) frame = CHARACTER_FRAMES.legacyKick;
    else if (this.dashTimer > 0) frame = CHARACTER_FRAMES.dash;
    else if (this.kickTimer > 0) {
      if (this.hasEnhancedPoseSheet) {
        const kickVisual = kickVisualAt({
          remaining: this.kickTimer,
          duration: PLAYER_TUNING.kickDuration,
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
    else if (this.kickTimer > 0) this.currentPose = this.shotType === 'lob' ? 'lob' : 'kick';
    else if (frame === CHARACTER_FRAMES.dash) this.currentPose = 'dash';
    else if (frame === CHARACTER_FRAMES.stun) this.currentPose = 'stun';
    this.sprite.setFrame(frame);
    this.applySecondaryMotion();
  }

  applySecondaryMotion() {
    // Ground registration belongs to the atlas. Do not animate the display
    // origin: even a one-pixel bob makes planted shoes visibly cross the pitch.
    this.visualOffsetY = 0;
    this.sprite.setDisplayOrigin(this.sprite.width / 2, this.visualGroundOriginY);
  }

  startKick(shotType = 'drive') {
    if (this.kickCooldown > 0 || this.stunned) return false;
    this.shotType = shotType;
    this.kickBoostTaps = 0;
    this.kickBoostAppliedTaps = 0;
    this.kickBoostAppliedStrength = 0;
    this.lastKickBoostSpent = 0;
    this.lastStrikePowered = false;
    this.kickTimer = PLAYER_TUNING.kickDuration;
    this.kickCooldown = PLAYER_TUNING.kickCooldown;
    this.kickSerial += 1;
    this.scene.events.emit('fighter-kick', this, this.powerArmed > 0);
    return true;
  }

  startDash() {
    if (this.dashCooldown > 0 || this.stunned) return false;
    this.stopSprint(true);
    this.dashTimer = PLAYER_TUNING.dashDuration;
    this.dashCooldown = scaled(PLAYER_TUNING.dashCooldown, 2 - this.stats.dash);
    this.scene.events.emit('fighter-dash', this);
    return true;
  }

  attemptBallStrike(ball) {
    if (this.kickTimer <= 0 || this.ballHitSerial === this.kickSerial) return null;
    const dx = ball.body.x - this.sprite.x;
    const dy = ball.body.y - this.sprite.y;
    if (dy < -CHARACTER_GAMEPLAY_HEIGHT * 0.18) return null;
    const inFront = dx * this.facing > -8 * this.bigGuyScale && dx * this.facing < 112 * this.bigGuyScale;
    if (!inFront || Math.abs(dy) > 104 * this.bigGuyScale) return null;
    this.ballHitSerial = this.kickSerial;
    const powered = this.powerArmed > 0;
    const lob = this.shotType === 'lob' && !powered;
    const speed = powered
      ? PLAYER_TUNING.powerShotSpeed
      : scaled(lob ? PLAYER_TUNING.lobSpeed : PLAYER_TUNING.kickSpeed, this.stats.kick);
    const lift = powered ? -3.8 : lob ? PLAYER_TUNING.lobLift : PLAYER_TUNING.kickLift;
    const boost = powered
      ? resolveKickBoost()
      : resolveKickBoost({ meter: this.meter, taps: this.kickBoostTaps, shotType: lob ? 'lob' : 'drive' });
    ball.body.setVelocity(this.facing * speed * boost.speedMultiplier, lift * boost.liftMultiplier);
    ball.body.setAngularVelocity(this.facing * 0.24);
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
    };
  }

  attemptChilena(ball) {
    const kickPresses = 1 + this.kickBoostTaps;
    const allowed = this.ballHitSerial !== this.kickSerial && canStartChilena({
      fighter: {
        x: this.sprite.x,
        y: this.sprite.y,
        height: CHARACTER_GAMEPLAY_HEIGHT,
        grounded: this.grounded,
        stunned: this.stunned,
        active: this.chilenaActive,
      },
      ball: { x: ball.body.x, y: ball.body.y },
      kickPresses,
    });
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
    this.chilenaElapsed = 0;
    this.chilenaSuccesses += 1;
    this.stopSprint(true);
    this.dashTimer = 0;
    this.kickTimer = 0;
    this.kickBoostTaps = 0;
    this.kickBoostAppliedTaps = 0;
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
    ball.body.setVelocity(shot.vx, shot.vy);
    ball.body.setAngularVelocity(shot.spin);
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
    this.syncChilenaVisual(chilenaRotationAt(this.chilenaElapsed));
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

  syncChilenaVisual(angle = this.chilenaVisual.angle) {
    this.sprite.setVisible(false);
    this.chilenaVisual
      .setVisible(true)
      .setPosition(this.sprite.x, this.sprite.y)
      .setDisplaySize(this.sprite.displayWidth, this.sprite.displayHeight)
      .setFlipX(this.facing !== this.textureFacing)
      .setFrame(this.hasPoseSheet ? 3 : 0)
      .setAngle(angle);
  }

  finishChilena() {
    this.chilenaActive = false;
    this.chilenaElapsed = 0;
    this.sprite.setAngle(0);
    this.sprite.setVisible(true);
    this.chilenaVisual.setAngle(0).setVisible(false);
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
    if (this.kickTimer <= 0 || this.combatHitSerial === this.kickSerial) return false;
    const dx = opponent.sprite.x - this.sprite.x;
    const dy = Math.abs(opponent.sprite.y - this.sprite.y);
    return dx * this.facing > 4 && dx * this.facing < 104 * this.bigGuyScale && dy < 94 * this.bigGuyScale;
  }

  markCombatHit() {
    this.combatHitSerial = this.kickSerial;
  }

  applyStun(fromDirection, strong = false) {
    if (this.superShield > 0) {
      this.superShield -= 1;
      this.scene.events.emit('fighter-shield-block', this);
      return false;
    }
    if (this.stunProtection > 0) return false;
    if (this.chilenaActive) this.finishChilena();
    this.stunTimer = strong ? PLAYER_TUNING.stunDuration * 1.12 : PLAYER_TUNING.stunDuration;
    this.stopSprint(true);
    this.stunProtection = this.stunTimer + PLAYER_TUNING.stunProtection;
    const knockback = strong ? PLAYER_TUNING.dashKnockback : PLAYER_TUNING.kickKnockback;
    this.sprite.setVelocity(fromDirection * knockback, strong ? -4.2 : -2.8);
    return true;
  }

  applyFreeze(fromDirection, seconds = 2) {
    if (this.chilenaActive) this.finishChilena();
    this.stopSprint(true);
    this.freezeTimer = Math.max(this.freezeTimer, seconds);
    this.stunTimer = Math.max(this.stunTimer, seconds);
    this.stunProtection = Math.max(this.stunProtection, seconds + PLAYER_TUNING.stunProtection);
    if (fromDirection === 0) this.sprite.setVelocity(0, 0);
    else this.sprite.setVelocity(fromDirection * 3.2, -1.4);
  }

  grantShield() {
    this.superShield = 1;
  }

  activateHyper(seconds = 5) {
    this.hyperTimer = Math.max(this.hyperTimer, seconds);
  }

  activateBigGuy() {
    this.bigGuy = activateBigGuy(this.bigGuy);
  }

  updateSprint(intent) {
    const direction = Math.sign(intent.move);
    if (!intent.sprint || direction === 0) {
      this.stopSprint(false);
      return;
    }
    if (this.sprinting && direction !== this.sprintDirection) {
      this.stopSprint(false);
      return;
    }
    if (!this.sprinting && !this.sprintRequiresRelease && this.grounded) {
      this.sprinting = true;
      this.sprintDirection = direction;
      this.scene.events.emit('fighter-sprint-start', this);
    }
  }

  stopSprint(requireRelease = false) {
    this.sprinting = false;
    this.sprintDirection = 0;
    if (requireRelease) this.sprintRequiresRelease = true;
  }

  setBigGuyScale(scale) {
    const nextScale = Phaser.Math.Clamp(Number(scale) || 1, 1, 2);
    if (Math.abs(nextScale - this.bigGuyScale) < 0.0001) return;
    const anchor = { x: this.sprite.body.position.x, y: this.sprite.body.bounds.max.y };
    this.sprite.setScale(
      this.baseSpriteScale.x * nextScale,
      this.baseSpriteScale.y * nextScale,
      anchor,
    );
    this.bigGuyScale = nextScale;
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
    if (this.sprinting) {
      const direction = Math.sign(this.sprite.body.velocity.x) || this.facing;
      this.aura.lineStyle(3, 0xdffbff, 0.32);
      for (let index = 0; index < 3; index += 1) {
        const y = this.sprite.y - 44 + index * 34;
        const startX = this.sprite.x - direction * (50 + index * 13);
        this.aura.strokeLineShape(new Phaser.Geom.Line(startX, y, startX - direction * (24 + index * 8), y));
      }
    }
    if (this.bigGuy.secondsRemaining > 0 || this.bigGuyScale > 1.01) {
      const pulse = 0.62 + Math.sin(this.scene.time.now * 0.015) * 0.12;
      this.aura.lineStyle(6, 0xffd25f, pulse);
      this.aura.strokeEllipse(
        this.sprite.x,
        this.sprite.y,
        126 * this.bigGuyScale,
        208 * this.bigGuyScale,
      );
    }
    if (this.stunned) {
      if (this.freezeTimer > 0) {
        this.aura.fillStyle(0xe8fcff, 0.95);
        for (let i = 0; i < 6; i += 1) {
          const angle = this.scene.time.now * 0.002 + (i * Math.PI * 2) / 6;
          this.aura.fillRect(
            this.sprite.x + Math.cos(angle) * 52 - 4,
            this.sprite.y - 35 + Math.sin(angle) * 82 - 4,
            8,
            8,
          );
        }
      } else {
        this.aura.fillStyle(0xffed7a, 0.9);
        for (let i = 0; i < 3; i += 1) {
          const angle = this.scene.time.now * 0.004 + (i * Math.PI * 2) / 3;
          this.aura.fillCircle(this.sprite.x + Math.cos(angle) * 38, this.sprite.y - 92 + Math.sin(angle) * 10, 5);
        }
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
    } else if (this.superShield > 0) {
      color = 0x55e0ee;
      tint = 0xdcfdff;
      strength = 4.5;
    } else if (this.hyperTimer > 0) {
      color = 0x8dff70;
      tint = 0xe3ffda;
      strength = 5;
    } else if (this.powerArmed > 0) {
      color = this.side === 'left' ? 0x62f5ff : 0xff9b42;
      tint = this.side === 'left' ? 0xe2fdff : 0xffead8;
      strength = 4;
    } else if (this.stunned) {
      tint = 0xb5c6d9;
    }

    if (this.statusGlow) {
      if (color !== null) this.statusGlow.color = color;
      this.statusGlow.outerStrength = strength > 0
        ? strength + Math.sin(this.scene.time.now * 0.018) * 0.7
        : 0;
    }
    if (tint === null) this.sprite.clearTint();
    else this.sprite.setTint(tint);

    if (this.chilenaGlow) {
      this.chilenaGlow.outerStrength = this.chilenaActive
        ? 5 + Math.sin(this.scene.time.now * 0.02) * 0.8
        : 0;
    }
    if (this.chilenaActive) this.chilenaVisual.setTint(0xffe1c7);
    else this.chilenaVisual.clearTint();
  }

  snapshot() {
    const velocity = this.sprite.body.velocity;
    const visualFrame = this.hasPoseSheet ? Number(this.sprite.frame.name) : 0;
    const visualGroundAnchorY = this.hasEnhancedPoseSheet && isGroundedVisualFrame(visualFrame)
      ? this.sprite.y + (CHARACTER_GROUND_ANCHOR_Y - this.sprite.displayOriginY) * this.sprite.scaleY
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
      kickTimer: Math.round(this.kickTimer * 100) / 100,
      powerArmed: this.powerArmed > 0,
      sprinting: this.sprinting,
      sprintSpeedMultiplier: this.sprinting ? SPRINT_SPEED_MULTIPLIER : 1,
      kickBoostTaps: this.kickBoostTaps,
      lastKickBoostSpent: this.lastKickBoostSpent,
      chilenaActive: this.chilenaActive,
      chilenaSeconds: Math.round(this.chilenaElapsed * 100) / 100,
      chilenaRotation: Math.round(this.chilenaVisual.angle * 10) / 10,
      chilenaSuccesses: this.chilenaSuccesses,
      pose: this.currentPose,
      visualFrame,
      displayWidth: Math.round(this.sprite.displayWidth * 10) / 10,
      displayHeight: Math.round(this.sprite.displayHeight * 10) / 10,
      enhancedAnimation: this.hasEnhancedPoseSheet,
      animationStage: this.currentAnimationStage,
      runPhase: this.currentRunPhase,
      visualOffsetY: Math.round(this.visualOffsetY * 100) / 100,
      visualGroundAnchorY: visualGroundAnchorY === null
        ? null
        : Math.round(visualGroundAnchorY * 10) / 10,
      shield: this.superShield,
      hyperSeconds: Math.round(this.hyperTimer * 100) / 100,
      bigGuySeconds: Math.round(this.bigGuy.secondsRemaining * 100) / 100,
      bigGuyScale: Math.round(this.bigGuyScale * 100) / 100,
    };
  }

  destroy() {
    this.aura.destroy();
    this.chilenaVisual.destroy();
    this.sprite.destroy();
  }
}
