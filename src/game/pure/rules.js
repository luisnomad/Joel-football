import {
  BALL_RADIUS,
  CROSSBAR_HEIGHT,
  CROSSBAR_Y,
  GOAL_LINE_LEFT,
  GOAL_LINE_RIGHT,
  GROUND_Y,
  MATCH_SECONDS,
} from '../constants.js';

const crossingHeightAt = (previous, current, lineX) => {
  const dx = current.x - previous.x;
  if (Math.abs(dx) < 0.0001) return current.y;
  const progress = Math.min(1, Math.max(0, (lineX - previous.x) / dx));
  return previous.y + (current.y - previous.y) * progress;
};

// Matter can leave a resting circle a fraction of a pixel inside a static
// surface. Treat that solver slop as contact with the goal-mouth boundary so
// identical ground-level shots do not alternate between scoring and missing.
const GOAL_MOUTH_TOLERANCE = 1.5;

export const detectGoalCrossing = ({ previous, current, radius = BALL_RADIUS } = {}) => {
  if (!previous || !current) return null;
  const crossbarBottom = CROSSBAR_Y + CROSSBAR_HEIGHT / 2;
  const fitsGoalMouth = (centerY) => (
    centerY - radius >= crossbarBottom - GOAL_MOUTH_TOLERANCE
    && centerY + radius <= GROUND_Y + GOAL_MOUTH_TOLERANCE
  );

  const rightThreshold = GOAL_LINE_RIGHT + radius;
  if (previous.x <= rightThreshold && current.x > rightThreshold) {
    return fitsGoalMouth(crossingHeightAt(previous, current, rightThreshold)) ? 'left' : null;
  }

  const leftThreshold = GOAL_LINE_LEFT - radius;
  if (previous.x >= leftThreshold && current.x < leftThreshold) {
    return fitsGoalMouth(crossingHeightAt(previous, current, leftThreshold)) ? 'right' : null;
  }

  return null;
};

export const createScoreState = () => ({
  left: 0,
  right: 0,
  secondsLeft: MATCH_SECONDS,
  suddenDeath: false,
  winner: null,
});

export const addGoal = (state, scoringSide) => ({
  ...state,
  [scoringSide]: state[scoringSide] + 1,
  winner: state.suddenDeath ? scoringSide : state.winner,
});

export const tickMatchClock = (state, deltaSeconds) => {
  if (state.winner || state.suddenDeath) return state;
  const secondsLeft = Math.max(0, state.secondsLeft - deltaSeconds);
  if (secondsLeft > 0) return { ...state, secondsLeft };
  if (state.left === state.right) {
    return { ...state, secondsLeft: 0, suddenDeath: true };
  }
  return { ...state, secondsLeft: 0, winner: state.left > state.right ? 'left' : 'right' };
};

export const formatClock = (secondsLeft, suddenDeath = false) => {
  if (suddenDeath) return 'GOLDEN GOAL';
  const whole = Math.max(0, Math.ceil(secondsLeft));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
};
