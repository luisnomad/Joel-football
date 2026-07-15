import Phaser from 'phaser';
import {
  CATEGORIES,
  CROSSBAR_HEIGHT,
  CROSSBAR_Y,
  GAME_WIDTH,
  GOAL_LINE_LEFT,
  GOAL_LINE_RIGHT,
} from '../constants.js';
import { getBallType } from '../content/matchCustomization.js';

const PERCH_RELEASE_DELAY = 0.38;

export class Ball {
  constructor(scene, x, y, typeId = 'classic') {
    this.scene = scene;
    this.type = getBallType(typeId);
    this.radius = this.type.radius;
    this.body = scene.matter.add.image(x, y, this.type.texture);
    this.body.setDisplaySize(this.type.displayWidth, this.type.displayHeight);
    if (this.type.shape === 'rectangle') {
      this.body.setRectangle(this.type.bodyWidth, this.type.bodyHeight, { chamfer: { radius: 6 } });
    } else {
      this.body.setCircle(this.radius);
    }
    this.body.setBounce(this.type.restitution);
    this.body.setFriction(this.type.friction, 0.006, 0.002);
    this.body.setFrictionAir(this.type.frictionAir);
    this.body.setDensity(this.type.density);
    this.body.setCollisionCategory(CATEGORIES.BALL);
    this.body.setCollidesWith([CATEGORIES.WORLD, CATEGORIES.PLAYER, CATEGORIES.GOAL]);
    this.body.body.label = 'ball';
    this.body.setDepth(20);
    this.goalPerchTimer = 0;
    this.outOfBoundsRecoveries = 0;
    this.surfaceCollisionCount = 0;
  }

  reset(x = 640, y = 340) {
    this.body.setStatic(false);
    this.body.setPosition(x, y);
    this.body.setVelocity(Phaser.Math.FloatBetween(-1.1, 1.1), -0.3);
    this.body.setAngularVelocity(0);
    this.body.setRotation(0);
    this.goalPerchTimer = 0;
  }

  recoverOutOfBounds() {
    const { x: vx, y: vy } = this.body.body.velocity;
    let recovered = false;
    if (this.body.x < -this.radius) {
      this.body.setPosition(this.radius, Math.max(this.radius, this.body.y));
      this.body.setVelocity(Math.max(4, Math.abs(vx) * 0.78), vy);
      recovered = true;
    } else if (this.body.x > GAME_WIDTH + this.radius) {
      this.body.setPosition(GAME_WIDTH - this.radius, Math.max(this.radius, this.body.y));
      this.body.setVelocity(-Math.max(4, Math.abs(vx) * 0.78), vy);
      recovered = true;
    } else if (this.body.y < -this.radius) {
      this.body.setPosition(this.body.x, this.radius);
      this.body.setVelocity(vx, Math.max(4, Math.abs(vy) * 0.78));
      recovered = true;
    }
    if (recovered) this.outOfBoundsRecoveries += 1;
    return recovered;
  }

  freeze() {
    this.body.setVelocity(0, 0);
    this.body.setAngularVelocity(0);
    this.body.setStatic(true);
    this.goalPerchTimer = 0;
  }

  clampVelocity(maxSpeed = this.type.maxSpeed) {
    const { x, y } = this.body.body.velocity;
    const speed = Math.hypot(x, y);
    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      this.body.setVelocity(x * ratio, y * ratio);
    }
  }

  applyMaterialForces() {
    if (this.type.gravityAssist <= 0 || this.body.body.isStatic) return;
    this.body.applyForce(new Phaser.Math.Vector2(
      0,
      -this.body.body.mass * 0.00078 * this.type.gravityAssist,
    ));
  }

  applyStrikeVelocity(vx, vy, { powered = false } = {}) {
    const speedScale = powered ? 0.65 + this.type.speedScale * 0.35 : this.type.speedScale;
    const liftScale = powered ? 0.72 + this.type.liftScale * 0.28 : this.type.liftScale;
    this.body.setVelocity(vx * speedScale, vy * liftScale);
  }

  applyStrikeSpin(spin) {
    const spinScale = this.type.family === 'cannonball' ? 0.28 : this.type.family === 'balloon' ? 0.65 : 1;
    this.body.setAngularVelocity(spin * spinScale);
  }

  onSurfaceCollision(label = '') {
    if (!label.includes('ground') && !label.includes('crossbar')) return false;
    this.surfaceCollisionCount += 1;
    if (this.type.wobble <= 0) return false;
    const { x, y } = this.body.body.velocity;
    const phase = Math.sin(this.surfaceCollisionCount * 2.399 + this.body.rotation * 1.7);
    const lateralKick = phase * this.type.wobble * (this.type.family === 'rugby' ? 8 : 4.5);
    this.body.setVelocity(x + lateralKick, y);
    this.body.setAngularVelocity(this.body.body.angularVelocity + phase * this.type.wobble * 0.34);
    return true;
  }

  releaseGoalPerch(dt) {
    const { x: vx, y: vy } = this.body.body.velocity;
    const perchY = CROSSBAR_Y - this.radius - CROSSBAR_HEIGHT / 2;
    const nearCrossbarTop = Math.abs(this.body.y - perchY) < 3;
    const nearlyStill = Math.hypot(vx, vy) < 0.7;
    const direction = this.body.x < GOAL_LINE_LEFT + this.radius
      ? 1
      : this.body.x > GOAL_LINE_RIGHT - this.radius
        ? -1
        : 0;

    if (!direction || !nearCrossbarTop || !nearlyStill) {
      this.goalPerchTimer = 0;
      return false;
    }

    this.goalPerchTimer += dt;
    if (this.goalPerchTimer < PERCH_RELEASE_DELAY) return false;

    this.goalPerchTimer = 0;
    this.body.setVelocity(direction * 4, -1.4);
    this.body.setAngularVelocity(direction * 0.12);
    return true;
  }

  snapshot() {
    const { x, y } = this.body.body.velocity;
    return {
      x: Math.round(this.body.x * 10) / 10,
      y: Math.round(this.body.y * 10) / 10,
      vx: Math.round(x * 100) / 100,
      vy: Math.round(y * 100) / 100,
      radius: this.radius,
      typeId: this.type.id,
      family: this.type.family,
      shape: this.type.shape,
      restitution: this.type.restitution,
      density: this.type.density,
      frictionAir: this.type.frictionAir,
      speedScale: this.type.speedScale,
      liftScale: this.type.liftScale,
      surfaceCollisionCount: this.surfaceCollisionCount,
      outOfBoundsRecoveries: this.outOfBoundsRecoveries,
    };
  }
}
