import { normalizeIntent } from '../pure/actions.js';

export const createHumanAgentProvider = (readInput) => ({
  id: 'human-input',
  type: 'human',
  decide: (snapshot) => normalizeIntent(readInput(snapshot)),
});
