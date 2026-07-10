export const MATH_OPERATIONS = Object.freeze(['addition', 'subtraction', 'multiplication', 'division']);

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

export const generateMathProblem = (operation, random = Math.random) => {
  const safeOperation = MATH_OPERATIONS.includes(operation) ? operation : 'addition';
  let left;
  let right;
  let answer;

  if (safeOperation === 'addition') {
    left = randomInt(10, 99, random);
    right = randomInt(10, 99, random);
    answer = left + right;
  } else if (safeOperation === 'subtraction') {
    right = randomInt(10, 99, random);
    answer = randomInt(10, 99, random);
    left = right + answer;
  } else if (safeOperation === 'multiplication') {
    left = randomInt(3, 12, random);
    right = randomInt(3, 12, random);
    answer = left * right;
  } else {
    right = randomInt(3, 12, random);
    answer = randomInt(3, 12, random);
    left = right * answer;
  }

  return Object.freeze({
    operation: safeOperation,
    symbol: SYMBOLS[safeOperation],
    left,
    right,
    answer,
    expression: `${left} ${SYMBOLS[safeOperation]} ${right}`,
  });
};

export const generateAnswerChoices = (answer, random = Math.random) => {
  const safeAnswer = Math.max(0, Math.floor(Number(answer) || 0));
  const candidates = [
    safeAnswer,
    Math.max(0, safeAnswer - 1),
    safeAnswer + 1,
    Math.max(0, safeAnswer - 2),
    safeAnswer + 2,
    Math.max(0, safeAnswer - 5),
    safeAnswer + 5,
    safeAnswer + 10,
  ];
  const unique = [...new Set(candidates)];
  for (let next = 0; unique.length < 4; next += 1) {
    if (!unique.includes(next)) unique.push(next);
  }

  const choices = [safeAnswer, ...unique.filter((value) => value !== safeAnswer).slice(0, 3)];
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
