export const MATH_OPERATIONS = Object.freeze(['addition', 'subtraction', 'multiplication', 'division']);

/**
 * Difficulty levels, easiest first. `champion` is the original age-nine set
 * (two-digit addition/subtraction, ×/÷ tables 3–12); the lab adapts between
 * levels (see stepMathProgress).
 */
export const MATH_LEVELS = Object.freeze(['starter', 'explorer', 'champion']);
export const DEFAULT_MATH_LEVEL = 'explorer';
const LEVEL_OPERATIONS = Object.freeze({
  starter: Object.freeze(['addition', 'subtraction']),
  explorer: Object.freeze(['addition', 'subtraction', 'multiplication']),
  champion: MATH_OPERATIONS,
});
/** Explorer multiplication uses the friendliest tables. */
const EXPLORER_TABLES = Object.freeze([2, 5, 10]);

/** Right answers in a row to move up a level, misses in a row to move down. */
export const MATH_LEVEL_UP_STREAK = 3;
/** Every this-many right answers in a row earn one extra charge (streak bonus). */
export const MATH_STREAK_BONUS_EVERY = 3;
export const MATH_LEVEL_DOWN_MISSES = 2;
/** Misses in a row before a short break, and its length. */
export const MATH_BREAK_AFTER_MISSES = 3;
export const MATH_BREAK_MS = 30 * 1_000;

const SYMBOLS = Object.freeze({
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
});

const randomInt = (min, max, random) => {
  const sample = Math.min(0.999999, Math.max(0, Number(random()) || 0));
  return min + Math.floor(sample * (max - min + 1));
};

export const sanitizeMathLevel = (level) => (MATH_LEVELS.includes(level) ? level : DEFAULT_MATH_LEVEL);

export const mathLevelOperations = (level = 'champion') => LEVEL_OPERATIONS[sanitizeMathLevel(level)];

export const chooseMathOperation = (random = Math.random, level = 'champion') => {
  const operations = mathLevelOperations(level);
  return operations[randomInt(0, operations.length - 1, random)];
};

const operandsFor = (operation, level, random) => {
  if (level === 'starter') {
    if (operation === 'addition') {
      const left = randomInt(1, 10, random);
      const right = randomInt(1, Math.min(10, 20 - left), random);
      return { left, right, answer: left + right };
    }
    const left = randomInt(5, 20, random);
    const right = randomInt(1, left - 1, random);
    return { left, right, answer: left - right };
  }
  if (level === 'explorer') {
    if (operation === 'addition') {
      const left = randomInt(11, 79, random);
      const right = randomInt(5, Math.min(49, 99 - left), random);
      return { left, right, answer: left + right };
    }
    if (operation === 'subtraction') {
      const left = randomInt(25, 99, random);
      const right = randomInt(5, left - 10, random);
      return { left, right, answer: left - right };
    }
    const table = EXPLORER_TABLES[randomInt(0, EXPLORER_TABLES.length - 1, random)];
    const factor = randomInt(2, 10, random);
    return random() < 0.5
      ? { left: table, right: factor, answer: table * factor }
      : { left: factor, right: table, answer: table * factor };
  }
  if (operation === 'addition') {
    const left = randomInt(10, 99, random);
    const right = randomInt(10, 99, random);
    return { left, right, answer: left + right };
  }
  if (operation === 'subtraction') {
    const right = randomInt(10, 99, random);
    const answer = randomInt(10, 99, random);
    return { left: right + answer, right, answer };
  }
  if (operation === 'multiplication') {
    const left = randomInt(3, 12, random);
    const right = randomInt(3, 12, random);
    return { left, right, answer: left * right };
  }
  const right = randomInt(3, 12, random);
  const answer = randomInt(3, 12, random);
  return { left: right * answer, right, answer };
};

/**
 * A problem of `operation` at `level` (default `champion`, the original set).
 * Answers are always non-negative integers; division is always exact.
 */
export const generateMathProblem = (operation, random = Math.random, level = 'champion') => {
  const safeLevel = sanitizeMathLevel(level);
  const allowed = mathLevelOperations(safeLevel);
  const safeOperation = allowed.includes(operation) ? operation : allowed[0];
  const { left, right, answer } = operandsFor(safeOperation, safeLevel, random);
  return Object.freeze({
    operation: safeOperation,
    level: safeLevel,
    symbol: SYMBOLS[safeOperation],
    left,
    right,
    answer,
    expression: `${left} ${SYMBOLS[safeOperation]} ${right}`,
  });
};

const onesOf = (value) => Math.abs(value) % 10;

/**
 * Wrong answers a child would actually give, most telling first: a forgotten
 * carry or borrow, the wrong operation, a neighbouring table fact, being off
 * by one or ten. Generic ±1/±2/±10 only fill the gaps.
 */
const realisticMistakes = (problem) => {
  const { operation, left, right, answer } = problem;
  const mistakes = [];
  if (operation === 'addition') {
    if (onesOf(left) + onesOf(right) >= 10) mistakes.push(answer - 10); // forgot the carry
    else mistakes.push(answer + 10);
    mistakes.push(Math.abs(left - right)); // subtracted instead
    mistakes.push(answer - 1, answer + 1);
  } else if (operation === 'subtraction') {
    if (onesOf(left) < onesOf(right)) {
      // took the smaller ones digit from the larger instead of borrowing
      const swapped = (Math.floor(left / 10) - Math.floor(right / 10)) * 10 + (onesOf(right) - onesOf(left));
      mistakes.push(swapped);
    } else {
      mistakes.push(answer + 10);
    }
    mistakes.push(left + right); // added instead
    mistakes.push(answer - 1, answer + 1);
  } else if (operation === 'multiplication') {
    mistakes.push((left + 1) * right, (left - 1) * right, left * (right + 1), left * (right - 1));
    mistakes.push(left + right); // added instead
  } else {
    mistakes.push(answer + 1, answer - 1, right, answer + 2);
    mistakes.push(left - right); // subtracted instead
  }
  mistakes.push(answer + 10, answer - 10, answer + 2, answer - 2, answer + 5, answer - 5);
  return mistakes;
};

/** The single most telling mistake for a problem, if it has one. */
const signatureMistake = (problem, random) => {
  const { operation, left, right, answer } = problem;
  if (operation === 'addition' && onesOf(left) + onesOf(right) >= 10) return answer - 10;
  if (operation === 'subtraction' && onesOf(left) < onesOf(right)) {
    return (Math.floor(left / 10) - Math.floor(right / 10)) * 10 + (onesOf(right) - onesOf(left));
  }
  if (operation === 'multiplication') {
    const neighbours = [(left + 1) * right, (left - 1) * right, left * (right + 1), left * (right - 1)];
    return neighbours[randomInt(0, neighbours.length - 1, random)];
  }
  return null;
};

const takeRandom = (list, count, random) => {
  const source = [...list];
  const taken = [];
  while (taken.length < count && source.length) {
    taken.push(source.splice(randomInt(0, source.length - 1, random), 1)[0]);
  }
  return taken;
};

/**
 * Four unique non-negative choices containing the answer, in random order. The
 * wrong ones are realistic mistakes (a forgotten carry or borrow, a
 * neighbouring table fact, off by one or ten) placed so the answer is equally
 * likely to be the smallest, a middle or the largest value: no "pick the
 * middle one" or "never the smallest" shortcut.
 * Accepts a problem (preferred) or a bare answer.
 */
export const generateAnswerChoices = (problemOrAnswer, random = Math.random) => {
  const problem = typeof problemOrAnswer === 'object' && problemOrAnswer !== null
    ? problemOrAnswer
    : { operation: null, answer: Math.max(0, Math.floor(Number(problemOrAnswer) || 0)) };
  const answer = Math.max(0, Math.floor(Number(problem.answer) || 0));
  const valid = (value) => Number.isInteger(value) && value >= 0 && value !== answer;
  const signature = signatureMistake({ ...problem, answer }, random);
  const fixed = valid(signature) ? [signature] : [];
  // Keep only plausible mistakes: a far-off "wrong operation" result would be
  // an obvious outlier that reveals which side the answer is on.
  const reach = Math.max(10, Math.ceil(answer * 0.3));
  const pool = [...new Set([
    ...realisticMistakes({ ...problem, answer }),
    answer - 1, answer + 1, answer - 2, answer + 2,
  ].map((value) => Math.floor(value)))]
    .filter((value) => valid(value) && !fixed.includes(value) && Math.abs(value - answer) <= reach);
  const below = pool.filter((value) => value < answer);
  const above = pool.filter((value) => value > answer);
  const fixedBelow = fixed.filter((value) => value < answer).length;
  const fixedAbove = fixed.length - fixedBelow;
  // `rank` = how many wrong choices sit below the answer; pick it uniformly
  // among the ranks this problem can support.
  const ranks = [0, 1, 2, 3].filter((rank) => {
    const needBelow = rank - fixedBelow;
    const needAbove = 3 - rank - fixedAbove;
    return needBelow >= 0 && needAbove >= 0 && needBelow <= below.length && needAbove <= above.length;
  });
  const rank = ranks.length ? ranks[randomInt(0, ranks.length - 1, random)] : null;
  const wrong = rank === null
    ? [...fixed, ...takeRandom(pool, 3 - fixed.length, random)]
    : [
      ...fixed,
      ...takeRandom(below, rank - fixedBelow, random),
      ...takeRandom(above, 3 - rank - fixedAbove, random),
    ];
  for (let next = answer + 4; wrong.length < 3; next += 1) {
    if (!wrong.includes(next)) wrong.push(next);
  }
  const choices = [answer, ...wrong.slice(0, 3)];
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index, random);
    [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
  }
  return choices;
};

export const isCorrectAnswer = (problem, value) => {
  if (!problem || value === '' || value === null || value === undefined) return false;
  return Number(value) === problem.answer;
};

/**
 * Short worked explanation shown after a wrong answer. `kind` selects the
 * visual: dots (small sums), tensOnes (two-digit add/subtract), skipCount (the
 * times-table row up to the answer), inverse (division as multiplication).
 */
export const explainMathProblem = (problem) => {
  const { operation, left, right, answer } = problem;
  if ((operation === 'addition' || operation === 'subtraction') && Math.max(left, right, answer) <= 20) {
    return { kind: 'dots', operation, left, right, answer };
  }
  if (operation === 'addition' || operation === 'subtraction') {
    // Add (or take away) the tens first, then the ones: never needs a
    // negative digit, unlike splitting both numbers into tens and ones.
    const rightTens = Math.floor(right / 10) * 10;
    const rightOnes = right - rightTens;
    const middle = operation === 'addition' ? left + rightTens : left - rightTens;
    return { kind: 'tensOnes', operation, left, right, answer, rightTens, rightOnes, middle };
  }
  if (operation === 'multiplication') {
    const step = right;
    const count = left;
    return {
      kind: 'skipCount',
      operation,
      left,
      right,
      answer,
      row: Array.from({ length: Math.min(count, 12) }, (_, index) => step * (index + 1)),
    };
  }
  return { kind: 'inverse', operation, left, right, answer };
};

/**
 * Adaptive progress after one answer. `misses` counts misses since the last
 * level change (two drop one level); `missRun` counts misses in a row overall
 * (three start a short break). Returns the next state plus what happened.
 */
export const stepMathProgress = ({
  level = DEFAULT_MATH_LEVEL,
  streak = 0,
  misses = 0,
  missRun = 0,
  rightRun = 0,
} = {}, correct) => {
  const index = MATH_LEVELS.indexOf(sanitizeMathLevel(level));
  if (correct) {
    const nextStreak = Math.max(0, Number(streak) || 0) + 1;
    const levelUp = nextStreak >= MATH_LEVEL_UP_STREAK && index < MATH_LEVELS.length - 1;
    // Independent of the level streak (which resets on a level change).
    const nextRightRun = Math.max(0, Number(rightRun) || 0) + 1;
    return {
      level: MATH_LEVELS[levelUp ? index + 1 : index],
      streak: levelUp ? 0 : nextStreak,
      misses: 0,
      missRun: 0,
      rightRun: nextRightRun,
      leveledUp: levelUp,
      leveledDown: false,
      takeBreak: false,
      bonusCharge: nextRightRun % MATH_STREAK_BONUS_EVERY === 0,
    };
  }
  const nextMisses = Math.max(0, Number(misses) || 0) + 1;
  const nextRun = Math.max(0, Number(missRun) || 0) + 1;
  const levelDown = nextMisses >= MATH_LEVEL_DOWN_MISSES && index > 0;
  const takeBreak = nextRun >= MATH_BREAK_AFTER_MISSES;
  return {
    level: MATH_LEVELS[levelDown ? index - 1 : index],
    streak: 0,
    misses: levelDown ? 0 : nextMisses,
    missRun: takeBreak ? 0 : nextRun,
    rightRun: 0,
    leveledUp: false,
    leveledDown: levelDown,
    takeBreak,
    bonusCharge: false,
  };
};
