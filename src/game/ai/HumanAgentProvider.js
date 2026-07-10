import { normalizeIntent } from '../pure/actions.js';

export const createHumanAgentProvider = (readInput) => ({
  id: 'human-input',
  decide: () => normalizeIntent(readInput()),
});
