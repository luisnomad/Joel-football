import { clamp } from './actions.js';

export const POWER_ARM_SECONDS = 3;

export const chargeMeter = (meter, amount, rateMultiplier = 1) =>
  clamp(meter + Math.max(0, amount) * Math.max(0.25, rateMultiplier), 0, 100);

export const canArmPower = ({ meter, stunned, powerArmed }) =>
  meter >= 100 && !stunned && powerArmed <= 0;

export const armPower = (state) =>
  canArmPower(state) ? { ...state, powerArmed: POWER_ARM_SECONDS } : state;

export const counterPowerVelocity = ({ incomingX, incomingY, facing }) => {
  const direction = facing >= 0 ? 1 : -1;
  const speed = Math.min(46, Math.max(24, Math.abs(incomingX) * 2));
  return { x: direction * speed, y: Math.min(-2.2, incomingY * -0.25 - 2.2) };
};
