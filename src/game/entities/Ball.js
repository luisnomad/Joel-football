import Phaser from 'phaser';
import {
  BALL_RADIUS,
  CATEGORIES,
  CROSSBAR_HEIGHT,
  CROSSBAR_Y,
  GAME_WIDTH,
  GOAL_LINE_LEFT,
  GOAL_LINE_RIGHT,
} from '../constants.js';

const PERCH_RELEASE_DELAY = 0.38;

export class Ball {
  constructor(scene, x, y) {
    this.scene = scene;
    this.body = scene.matter.add.image(x, y, 'ball');
    this.body.setDisplaySize(58, 58);
    this.body.setCircle(BALL_RADIUS);
    this.body.setBounce(0.82);
    this.body.setFriction(0.018, 0.006, 0.002);
    this.body.setFrictionAir(0.0035);
    this.body.setCollisionCategory(CATEGORIES.BALL);
    this.body.setCollidesWith([CATEGORIES.WORLD, CATEGORIES.PLAYER, CATEGORIES.GOAL]);
    this.body.body.label = 'ball';
    this.body.setDepth(20);
    this.goalPerchTimer = 0;
    this.outOfBoundsRecoveries = 0;
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
    if (this.body.x < -BALL_RADIUS) {
      this.body.setPosition(BALL_RADIUS, Math.max(BALL_RADIUS, this.body.y));
      this.body.setVelocity(Math.max(4, Math.abs(vx) * 0.78), vy);
      recovered = true;
    } else if (this.body.x > GAME_WIDTH + BALL_RADIUS) {
      this.body.setPosition(GAME_WIDTH - BALL_RADIUS, Math.max(BALL_RADIUS, this.body.y));
      this.body.setVelocity(-Math.max(4, Math.abs(vx) * 0.78), vy);
      recovered = true;
    } else if (this.body.y < -BALL_RADIUS) {
      this.body.setPosition(this.body.x, BALL_RADIUS);
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

  clampVelocity(maxSpeed = 27) {
    const { x, y } = this.body.body.velocity;
    const speed = Math.hypot(x, y);
    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      this.body.setVelocity(x * ratio, y * ratio);
    }
  }

  releaseGoalPerch(dt) {
    const { x: vx, y: vy } = this.body.body.velocity;
    const perchY = CROSSBAR_Y - BALL_RADIUS - CROSSBAR_HEIGHT / 2;
    const nearCrossbarTop = Math.abs(this.body.y - perchY) < 3;
    const nearlyStill = Math.hypot(vx, vy) < 0.7;
    const direction = this.body.x < GOAL_LINE_LEFT + BALL_RADIUS
      ? 1
      : this.body.x > GOAL_LINE_RIGHT - BALL_RADIUS
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
      radius: BALL_RADIUS,
      outOfBoundsRecoveries: this.outOfBoundsRecoveries,
    };
  }
}
