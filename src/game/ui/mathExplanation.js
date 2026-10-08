import { t } from '../i18n.js';
import { explainMathProblem } from '../pure/mathChallenge.js';

const DOT_LEFT = 0x4fe0ff;
const DOT_RIGHT = 0xffd256;
const CROSS = 0xff6f86;

const style = (size, color, fontFamily) => ({
  fontFamily,
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  align: 'center',
});

/**
 * Worked explanation shown after a wrong Power Lab answer (shared by the tablet
 * and phone labs). Draws "The answer is N", a one-line hint and a small visual:
 * coloured dots for small sums, tens-then-ones steps, the times-table row, or
 * the inverse fact for division. Returns the created objects.
 */
export const renderMathExplanation = (scene, {
  x,
  y,
  problem,
  language,
  depth = 202,
  scale = 1,
  fontFamily = 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
}) => {
  const objects = [];
  const add = (object) => {
    object.setDepth(depth);
    objects.push(object);
    return object;
  };
  const explanation = explainMathProblem(problem);
  add(scene.add.text(x, y, t(language, 'lab.answerIs', { answer: problem.answer }), style(30 * scale, '#7ff7d7', fontFamily))
    .setOrigin(0.5));
  const hintY = y + 40 * scale;
  const visualY = y + 82 * scale;

  if (explanation.kind === 'dots') {
    add(scene.add.text(x, hintY, t(language, 'lab.explain.dots'), style(18 * scale, '#bcd1eb', fontFamily)).setOrigin(0.5));
    const total = explanation.operation === 'addition' ? explanation.answer : explanation.left;
    const perRow = 10;
    const gap = 22 * scale;
    const radius = 8 * scale;
    const rows = Math.ceil(total / perRow);
    const graphics = add(scene.add.graphics());
    for (let index = 0; index < total; index += 1) {
      const column = index % perRow;
      const row = Math.floor(index / perRow);
      const width = Math.min(total - row * perRow, perRow);
      const dotX = x - ((width - 1) * gap) / 2 + column * gap;
      const dotY = visualY + (row - (rows - 1) / 2) * gap;
      const second = explanation.operation === 'addition' ? index >= explanation.left : false;
      graphics.fillStyle(second ? DOT_RIGHT : DOT_LEFT, 1).fillCircle(dotX, dotY, radius);
      if (explanation.operation === 'subtraction' && index >= explanation.answer) {
        graphics.lineStyle(3 * scale, CROSS, 1)
          .lineBetween(dotX - radius, dotY - radius, dotX + radius, dotY + radius)
          .lineBetween(dotX - radius, dotY + radius, dotX + radius, dotY - radius);
      }
    }
    return objects;
  }

  if (explanation.kind === 'tensOnes') {
    const add2 = explanation.operation === 'addition';
    const symbol = add2 ? '+' : '−';
    add(scene.add.text(
      x,
      hintY,
      t(language, add2 ? 'lab.explain.tensAdd' : 'lab.explain.tensSubtract'),
      style(18 * scale, '#bcd1eb', fontFamily),
    ).setOrigin(0.5));
    const steps = [];
    if (explanation.rightTens > 0) {
      steps.push(`${explanation.left} ${symbol} ${explanation.rightTens} = ${explanation.middle}`);
    }
    if (explanation.rightOnes > 0 || steps.length === 0) {
      steps.push(`${explanation.middle} ${symbol} ${explanation.rightOnes} = ${explanation.answer}`);
    }
    add(scene.add.text(x, visualY, steps.join('   →   '), style(24 * scale, '#ffffff', fontFamily)).setOrigin(0.5));
    return objects;
  }

  if (explanation.kind === 'skipCount') {
    add(scene.add.text(
      x,
      hintY,
      t(language, 'lab.explain.skipCount', { step: explanation.right }),
      style(18 * scale, '#bcd1eb', fontFamily),
    ).setOrigin(0.5));
    const row = explanation.row.slice(0, -1).join(', ');
    const lead = add(scene.add.text(0, visualY, row ? `${row}, ` : '', style(22 * scale, '#ffffff', fontFamily)).setOrigin(0, 0.5));
    const last = add(scene.add.text(0, visualY, String(explanation.answer), style(26 * scale, '#ffd256', fontFamily)).setOrigin(0, 0.5));
    const width = lead.width + last.width;
    lead.setX(x - width / 2);
    last.setX(lead.x + lead.width);
    return objects;
  }

  add(scene.add.text(x, visualY - 20 * scale, t(language, 'lab.explain.inverse', {
    left: explanation.left,
    right: explanation.right,
    answer: explanation.answer,
  }), style(22 * scale, '#ffffff', fontFamily)).setOrigin(0.5));
  return objects;
};
