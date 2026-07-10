import Phaser from 'phaser';
import { CATEGORIES, DEFAULT_STATS, GROUND_Y, PLAYER_TUNING } from '../constants.js';
import { resolveFacing } from '../pure/facing.js';
import { armPower, chargeMeter } from '../pure/power.js';

const scaled = (base, stat) => base * (0.9 + stat * 0.1);

export class Fighter {
  constructor(scene, { id, side, x, texture, name, stats = DEFAULT_STATS }) {
    this.scene = scene;
    this.id = id;
    this.side = side;
    this.name = name;
    this.stats = { ...DEFAULT_STATS, ...stats };
    this.facing = side === 'left' ? 1 : -1;
    this.baseFacing = this.facing;
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
    this.superShield = 0;
    this.hyperTimer = 0;
    this.freezeTimer = 0;
    this.runCycle = 0;
    this.lastRunFrame = 0;
    this.currentPose = 'idle';

    const { Bodies, Body } = Phaser.Physics.Matter.Matter;
    const head = Bodies.circle(0, -52, 43, {
      label: `${id}:head`,
      restitution: 0.1,
      friction: 0.15,
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
      parts: [head, torso, foot],
      friction: 0.2,
      frictionAir: 0.018,
      restitution: 0.02,
      inertia: Infinity,
    });

    this.sprite = scene.add.sprite(x, GROUND_Y - 89, texture, 0);
    this.hasPoseSheet = this.sprite.texture.frameTotal >= 6;
    this.sprite.setDisplaySize(this.hasPoseSheet ? 185 : 205, this.hasPoseSheet ? 240 : 205);
    this.sprite.setDepth(18);
    scene.matter.add.gameObject(this.sprite, compound);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setPosition(x, GROUND_Y - 89);
    this.sprite.setFixedRotation();
    this.sprite.setCollisionCategory(CATEGORIES.PLAYER);
    this.sprite.setCollidesWith([CATEGORIES.WORLD, CATEGORIES.PLAYER, CATEGORIES.BALL, CATEGORIES.GOAL]);

    this.aura = scene.add.graphics().setDepth(17);
  }

  get grounded() {
    return this.sprite.y >= GROUND_Y - 94 && Math.abs(this.sprite.body.velocity.y) < 1.8;
  }

  get stunned() {
    return this.stunTimer > 0;
  }

  reset(x) {
    this.sprite.setPosition(x, GROUND_Y - 89);
    this.sprite.setVelocity(0, 0);
    this.sprite.setAngularVelocity(0);
    this.kickTimer = 0;
    this.dashTimer = 0;
    this.stunTimer = 0;
    this.stunProtection = 0;
    this.powerArmed = 0;
    this.jumpCounterWindow = 0;
    this.superShield = 0;
    this.hyperTimer = 0;
    this.freezeTimer = 0;
    this.runCycle = 0;
    this.lastRunFrame = 0;
    this.currentPose = 'idle';
    this.setFacing(this.baseFacing);
    if (this.hasPoseSheet) this.sprite.setFrame(0);
    this.sprite.clearTint();
    this.aura.clear();
  }

  update(intent, dt, opponentX) {
    this.kickTimer = Math.max(0, this.kickTimer - dt);
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.stunProtection = Math.max(0, this.stunProtection - dt);
    this.powerArmed = Math.max(0, this.powerArmed - dt);
    this.jumpCounterWindow = Math.max(0, this.jumpCounterWindow - dt);
    this.hyperTimer = Math.max(0, this.hyperTimer - dt);
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    this.meter = chargeMeter(this.meter, PLAYER_TUNING.passiveChargePerSecond * dt, this.stats.power);

    if (this.stunned) {
      this.sprite.setTint(this.freezeTimer > 0 ? 0x78ddff : 0xb5c6d9);
      this.updatePose();
      this.renderAura();
      return;
    }
    this.sprite.clearTint();

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
      this.sprite.applyForce({ x: intent.move * scaled(PLAYER_TUNING.moveForce, this.stats.speed) * airMultiplier * hyperForce, y: 0 });
      const hyperSpeed = this.hyperTimer > 0 ? 1.25 : 1;
      const maxSpeed = scaled(PLAYER_TUNING.maxSpeed, this.stats.speed) * (airborne ? 1.08 : 1) * hyperSpeed;
      this.sprite.setVelocityX(Phaser.Math.Clamp(this.sprite.body.velocity.x, -maxSpeed, maxSpeed));
    } else if (this.grounded) {
      this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.82);
    }

    if (this.grounded && Math.abs(this.sprite.body.velocity.x) > 0.65) {
      this.runCycle += dt * Math.max(7, Math.abs(this.sprite.body.velocity.x) * 1.25);
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
    let frame = 0;
    if (this.stunned) frame = 5;
    else if (this.dashTimer > 0) frame = 4;
    else if (this.kickTimer > 0) frame = 3;
    else if (!this.grounded) frame = 2;
    else if (Math.abs(this.sprite.body.velocity.x) > 0.65) {
      const stridePhase = Math.floor(this.runCycle) % 2;
      frame = stridePhase === 0 ? 1 : 0;
      this.currentPose = stridePhase === 0 ? 'run-stride' : 'run-contact';
      if (stridePhase !== this.lastRunFrame) {
        this.lastRunFrame = stridePhase;
        this.scene.events.emit('fighter-step', this);
      }
    }
    if (frame === 0 && Math.abs(this.sprite.body.velocity.x) <= 0.65) this.currentPose = 'idle';
    else if (frame === 2) this.currentPose = 'jump';
    else if (frame === 3) this.currentPose = this.shotType === 'lob' ? 'lob' : 'kick';
    else if (frame === 4) this.currentPose = 'dash';
    else if (frame === 5) this.currentPose = 'stun';
    this.sprite.setFrame(frame);
  }

  startKick(shotType = 'drive') {
    if (this.kickCooldown > 0 || this.stunned) return false;
    this.shotType = shotType;
    this.kickTimer = PLAYER_TUNING.kickDuration;
    this.kickCooldown = PLAYER_TUNING.kickCooldown;
    this.kickSerial += 1;
    this.scene.events.emit('fighter-kick', this, this.powerArmed > 0);
    return true;
  }

  startDash() {
    if (this.dashCooldown > 0 || this.stunned) return false;
    this.dashTimer = PLAYER_TUNING.dashDuration;
    this.dashCooldown = scaled(PLAYER_TUNING.dashCooldown, 2 - this.stats.dash);
    this.scene.events.emit('fighter-dash', this);
    return true;
  }

  attemptBallStrike(ball) {
    if (this.kickTimer <= 0 || this.ballHitSerial === this.kickSerial) return null;
    const dx = ball.body.x - this.sprite.x;
    const dy = ball.body.y - this.sprite.y;
    const inFront = dx * this.facing > -8 && dx * this.facing < 112;
    if (!inFront || Math.abs(dy) > 104) return null;
    this.ballHitSerial = this.kickSerial;
    const powered = this.powerArmed > 0;
    const lob = this.shotType === 'lob' && !powered;
    const speed = powered
      ? PLAYER_TUNING.powerShotSpeed
      : scaled(lob ? PLAYER_TUNING.lobSpeed : PLAYER_TUNING.kickSpeed, this.stats.kick);
    const lift = powered ? -3.8 : lob ? PLAYER_TUNING.lobLift : PLAYER_TUNING.kickLift;
    ball.body.setVelocity(this.facing * speed, lift);
    ball.body.setAngularVelocity(this.facing * 0.24);
    if (powered) {
      this.meter = 0;
      this.powerArmed = 0;
    } else {
      this.meter = chargeMeter(this.meter, PLAYER_TUNING.contactCharge, this.stats.power);
    }
    return { powered, owner: this.side, shotType: lob ? 'lob' : 'drive' };
  }

  canHitOpponent(opponent) {
    if (this.kickTimer <= 0 || this.combatHitSerial === this.kickSerial) return false;
    const dx = opponent.sprite.x - this.sprite.x;
    const dy = Math.abs(opponent.sprite.y - this.sprite.y);
    return dx * this.facing > 4 && dx * this.facing < 104 && dy < 94;
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
    this.stunTimer = strong ? PLAYER_TUNING.stunDuration * 1.12 : PLAYER_TUNING.stunDuration;
    this.stunProtection = this.stunTimer + PLAYER_TUNING.stunProtection;
    const knockback = strong ? PLAYER_TUNING.dashKnockback : PLAYER_TUNING.kickKnockback;
    this.sprite.setVelocity(fromDirection * knockback, strong ? -4.2 : -2.8);
    return true;
  }

  applyFreeze(fromDirection, seconds = 2) {
    this.freezeTimer = Math.max(this.freezeTimer, seconds);
    this.stunTimer = Math.max(this.stunTimer, seconds);
    this.stunProtection = Math.max(this.stunProtection, seconds + PLAYER_TUNING.stunProtection);
    this.sprite.setVelocity(fromDirection * 3.2, -1.4);
  }

  grantShield() {
    this.superShield = 1;
  }

  activateHyper(seconds = 5) {
    this.hyperTimer = Math.max(this.hyperTimer, seconds);
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
    this.sprite.setFlipX(this.facing !== this.baseFacing);
  }

  renderAura() {
    this.aura.clear();
    if (this.powerArmed > 0) {
      const pulse = 1 + Math.sin(this.scene.time.now * 0.018) * 0.12;
      this.aura.lineStyle(5, this.side === 'left' ? 0x62f5ff : 0xff9b42, 0.72);
      this.aura.strokeCircle(this.sprite.x, this.sprite.y - 35, 51 * pulse);
    }
    if (this.superShield > 0) {
      this.aura.lineStyle(4, 0x7df7ff, 0.72);
      this.aura.strokeCircle(this.sprite.x, this.sprite.y - 32, 58);
    }
    if (this.hyperTimer > 0) {
      this.aura.lineStyle(4, 0x9aff75, 0.55 + Math.sin(this.scene.time.now * 0.02) * 0.12);
      this.aura.strokeEllipse(this.sprite.x, this.sprite.y - 25, 104, 178);
    }
    if (this.kickTimer > 0) {
      this.aura.fillStyle(0xffffff, 0.7);
      this.aura.fillEllipse(this.sprite.x + this.facing * 57, this.sprite.y + 43, 42, 15);
    }
    if (this.stunned) {
      if (this.freezeTimer > 0) {
        this.aura.lineStyle(5, 0xbef5ff, 0.85);
        this.aura.strokeEllipse(this.sprite.x, this.sprite.y - 25, 112, 184);
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

  snapshot() {
    const velocity = this.sprite.body.velocity;
    return {
      id: this.id,
      name: this.name,
      x: Math.round(this.sprite.x * 10) / 10,
      y: Math.round(this.sprite.y * 10) / 10,
      vx: Math.round(velocity.x * 100) / 100,
      vy: Math.round(velocity.y * 100) / 100,
      facing: this.facing,
      grounded: this.grounded,
      stunned: this.stunned,
      frozen: this.freezeTimer > 0,
      freezeSeconds: Math.round(this.freezeTimer * 100) / 100,
      meter: Math.round(this.meter * 10) / 10,
      kickCooldown: Math.round(this.kickCooldown * 100) / 100,
      dashCooldown: Math.round(this.dashCooldown * 100) / 100,
      powerArmed: this.powerArmed > 0,
      pose: this.currentPose,
      visualFrame: this.hasPoseSheet ? Number(this.sprite.frame.name) : 0,
      shield: this.superShield,
      hyperSeconds: Math.round(this.hyperTimer * 100) / 100,
    };
  }

  destroy() {
    this.aura.destroy();
    this.sprite.destroy();
  }
}
