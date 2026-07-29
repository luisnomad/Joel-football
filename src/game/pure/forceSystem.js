const clamp = (value, minimum, maximum) => Math.min(
  maximum,
  Math.max(minimum, Number(value) || 0),
);

const round = (value, places = 6) => {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
};

export const FORCE_DIFFICULTY = Object.freeze({
  easy: Object.freeze({ resistance: 0.85, decay: 0.75 }),
  normal: Object.freeze({ resistance: 1, decay: 1 }),
  hard: Object.freeze({ resistance: 1.2, decay: 1.25 }),
});

/**
 * Returns the force that survives a number of contacts in a connected chain.
 * Geometry discovery stays with the consuming game; this pure function owns
 * only attenuation and the cut-offs shared by different physics engines.
 */
export const resolveForceTransmission = ({
  force = 0,
  retention = 0.84,
  hops = 1,
  alignment = 1,
  gap = 0,
  maximumGap = 8,
  minimumForce = 0.12,
} = {}) => {
  const safeForce = Math.max(0, Number(force) || 0);
  const safeRetention = clamp(retention, 0, 1);
  const safeHops = Math.max(0, Math.floor(Number(hops) || 0));
  const safeAlignment = clamp(alignment, 0, 1);
  if (Math.max(0, Number(gap) || 0) > Math.max(0, Number(maximumGap) || 0)) return 0;
  const transmitted = safeForce * (safeRetention ** safeHops) * safeAlignment;
  return transmitted >= Math.max(0, Number(minimumForce) || 0)
    ? transmitted
    : 0;
};

/**
 * Converts repeated purposeful impacts into the player's intuitive "kick it
 * harder" action. Context IDs are game-owned (for example lane + direction).
 */
export const resolveForceCombo = ({
  contextId = null,
  previousContextId = null,
  previousAt = Number.NEGATIVE_INFINITY,
  previousStage = -1,
  now = 0,
  windowSeconds = 0.9,
  multipliers = [1, 1.25, 1.5],
} = {}) => {
  const safeMultipliers = multipliers.length ? multipliers : [1];
  const elapsed = (Number(now) || 0) - Number(previousAt);
  const continues = contextId !== null
    && contextId === previousContextId
    && Number.isFinite(elapsed)
    && elapsed >= 0
    && elapsed <= Math.max(0, Number(windowSeconds) || 0);
  const stage = continues
    ? Math.min(safeMultipliers.length - 1, Math.max(0, Math.floor(previousStage) + 1))
    : 0;
  return {
    contextId,
    at: Number(now) || 0,
    stage,
    multiplier: Math.max(0, Number(safeMultipliers[stage]) || 0),
  };
};

/**
 * Adds force to a temporary pressure reservoir. Direct impacts can remain a
 * reliable one-hit interaction even when remote queue pressure is resisted.
 */
export const resolvePressureImpact = ({
  pressure = 0,
  incomingForce = 0,
  resistance = 1,
  direct = false,
  directReleases = true,
} = {}) => {
  const safeResistance = Math.max(Number.EPSILON, Number(resistance) || 0);
  const appliedForce = Math.max(0, Number(incomingForce) || 0);
  const nextPressure = Math.max(0, Number(pressure) || 0) + appliedForce;
  const released = Boolean(direct && directReleases) || nextPressure >= safeResistance;
  return {
    appliedForce,
    pressure: nextPressure,
    pressureRatio: clamp(nextPressure / safeResistance, 0, 1),
    released,
  };
};

export const resolveForceDamage = ({
  incomingForce = 0,
  resistance = 1,
  minimumForce = 0.12,
  maximumDamage = 1,
} = {}) => {
  const force = Math.max(0, Number(incomingForce) || 0);
  if (force < Math.max(0, Number(minimumForce) || 0)) return 0;
  return clamp(
    force / Math.max(Number.EPSILON, Number(resistance) || 0),
    0,
    Math.max(0, Number(maximumDamage) || 0),
  );
};

export const decayPressure = ({
  pressure = 0,
  dt = 0,
  secondsSinceImpact = Number.POSITIVE_INFINITY,
  graceSeconds = 0.5,
  decayPerSecond = 0.8,
} = {}) => {
  const safePressure = Math.max(0, Number(pressure) || 0);
  if (Number(secondsSinceImpact) <= Math.max(0, Number(graceSeconds) || 0)) {
    return safePressure;
  }
  return Math.max(
    0,
    safePressure - Math.max(0, Number(dt) || 0) * Math.max(0, Number(decayPerSecond) || 0),
  );
};

export const resolveDifficultyPressureTuning = ({
  difficulty = 'normal',
  baseResistance = 1,
  baseDecayPerSecond = 0.8,
  profiles = FORCE_DIFFICULTY,
} = {}) => {
  const profile = profiles[difficulty] ?? profiles.normal ?? FORCE_DIFFICULTY.normal;
  return {
    resistance: round(Math.max(0, Number(baseResistance) || 0) * Math.max(0, Number(profile.resistance) || 0)),
    decayPerSecond: round(
      Math.max(0, Number(baseDecayPerSecond) || 0) * Math.max(0, Number(profile.decay) || 0),
    ),
  };
};
