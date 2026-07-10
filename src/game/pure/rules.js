import { MATCH_SECONDS } from '../constants.js';

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
