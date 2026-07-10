export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const HUMAN_PLAYER_ID = 'joel';
export const HUMAN_PLAYER_NAME = 'JOEL';
export const GROUND_Y = 636;
export const CROSSBAR_Y = 432;
export const CROSSBAR_HEIGHT = 17;
export const GOAL_LINE_LEFT = 126;
export const GOAL_LINE_RIGHT = GAME_WIDTH - GOAL_LINE_LEFT;
export const BALL_RADIUS = 22;
export const MATCH_SECONDS = 90;
export const FIXED_STEP = 1 / 60;

export const SIDES = Object.freeze({ LEFT: 'left', RIGHT: 'right' });

export const CATEGORIES = Object.freeze({
  WORLD: 0x0001,
  PLAYER: 0x0002,
  BALL: 0x0004,
  GOAL: 0x0008,
});

export const DEFAULT_STATS = Object.freeze({
  speed: 1,
  jump: 1,
  kick: 1,
  dash: 1,
  power: 1,
});

export const PLAYER_TUNING = Object.freeze({
  moveForce: 0.0204,
  maxSpeed: 14.16,
  jumpVelocity: -11.5,
  airControlMultiplier: 1.38,
  fastFallAcceleration: 0.34,
  kickSpeed: 16.5,
  kickLift: -3.2,
  lobSpeed: 9.4,
  lobLift: -12.4,
  kickDuration: 0.16,
  kickCooldown: 0.42,
  dashSpeed: 16,
  dashDuration: 0.14,
  dashCooldown: 1.45,
  stunDuration: 0.58,
  stunProtection: 0.65,
  kickKnockback: 6.8,
  dashKnockback: 9.2,
  passiveChargePerSecond: 2.6,
  contactCharge: 4.5,
  defensiveCharge: 8,
  powerShotSpeed: 23,
  powerDuration: 3.2,
  counterWindow: 0.34,
});

export const EMPTY_INTENT = Object.freeze({
  move: 0,
  jump: false,
  kick: false,
  lob: false,
  dash: false,
  power: false,
});
