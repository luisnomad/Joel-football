export const ENHANCED_CHARACTER_FRAME_COUNT = 12;
export const RUN_FRAME_DISTANCE = 30;
export const CHARACTER_GROUND_ANCHOR_Y = 418;

export const CHARACTER_FRAMES = Object.freeze({
  idle: 0,
  legacyRun: 1,
  jump: 2,
  legacyKick: 3,
  dash: 4,
  stun: 5,
  runContactA: 6,
  runPassing: 7,
  runContactB: 8,
  kickAnticipation: 9,
  kickContact: 10,
  kickRecovery: 11,
});

export const RUN_VISUAL_SEQUENCE = Object.freeze([
  CHARACTER_FRAMES.runContactA,
  CHARACTER_FRAMES.runPassing,
  CHARACTER_FRAMES.runContactB,
  CHARACTER_FRAMES.runPassing,
]);

export const GROUNDED_VISUAL_FRAMES = Object.freeze([
  CHARACTER_FRAMES.idle,
  CHARACTER_FRAMES.legacyRun,
  CHARACTER_FRAMES.dash,
  CHARACTER_FRAMES.stun,
  CHARACTER_FRAMES.runContactA,
  CHARACTER_FRAMES.runPassing,
  CHARACTER_FRAMES.runContactB,
  CHARACTER_FRAMES.kickAnticipation,
  CHARACTER_FRAMES.kickContact,
  CHARACTER_FRAMES.kickRecovery,
]);

export const isGroundedVisualFrame = (frame) => GROUNDED_VISUAL_FRAMES.includes(Number(frame));

const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export const runVisualAt = (cycle = 0) => {
  const phase = positiveModulo(Math.floor(Number(cycle) || 0), RUN_VISUAL_SEQUENCE.length);
  const contact = phase % 2 === 0;
  return {
    frame: RUN_VISUAL_SEQUENCE[phase],
    phase,
    pose: contact ? 'run-contact' : 'run-stride',
    stage: ['contact-a', 'passing-a', 'contact-b', 'passing-b'][phase],
    footstep: contact,
    bob: 0,
  };
};

export const kickVisualAt = ({ remaining = 0, duration = 1 } = {}) => {
  const safeDuration = Math.max(Number(duration) || 0, Number.EPSILON);
  const progress = Math.min(1, Math.max(0, 1 - (Number(remaining) || 0) / safeDuration));
  if (progress < 0.28) {
    return { frame: CHARACTER_FRAMES.kickAnticipation, stage: 'anticipation', progress };
  }
  if (progress < 0.68) {
    return { frame: CHARACTER_FRAMES.kickContact, stage: 'contact', progress };
  }
  return { frame: CHARACTER_FRAMES.kickRecovery, stage: 'recovery', progress };
};
