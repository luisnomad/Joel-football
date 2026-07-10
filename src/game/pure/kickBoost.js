export const KICK_BOOST_MAX_TAPS = 3;
export const KICK_BOOST_ENERGY_PER_TAP = 8;

const clampTaps = (value) => Math.min(
  KICK_BOOST_MAX_TAPS,
  Math.max(0, Math.floor(Number(value) || 0)),
);

const rounded = (value) => Math.round(value * 1000) / 1000;

export const kickBoostMultipliers = (strength = 0, shotType = 'drive') => {
  const safeStrength = Math.min(1, Math.max(0, Number(strength) || 0));
  const lob = shotType === 'lob';
  return {
    speedMultiplier: rounded(1 + (lob ? 0.16 : 0.27) * safeStrength),
    liftMultiplier: rounded(1 + (lob ? 0.27 : 0.1) * safeStrength),
  };
};

export const addKickBoostTaps = (current = 0, added = 1) => clampTaps(
  clampTaps(current) + Math.max(0, Math.floor(Number(added) || 0)),
);

export const resolveKickBoost = ({ meter = 0, taps = 0, shotType = 'drive' } = {}) => {
  const safeMeter = Math.min(100, Math.max(0, Number(meter) || 0));
  const requestedEnergy = clampTaps(taps) * KICK_BOOST_ENERGY_PER_TAP;
  const energySpent = Math.min(safeMeter, requestedEnergy);
  const strength = energySpent / (KICK_BOOST_MAX_TAPS * KICK_BOOST_ENERGY_PER_TAP);
  const multipliers = kickBoostMultipliers(strength, shotType);
  return {
    boosted: energySpent > 0,
    energySpent: rounded(energySpent),
    meterAfter: rounded(safeMeter - energySpent),
    strength: rounded(strength),
    ...multipliers,
  };
};
