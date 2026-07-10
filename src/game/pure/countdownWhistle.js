export const nextCountdownWhistle = (previousSecond = 0, countdown = 0) => {
  const safeCountdown = Math.max(0, Number(countdown) || 0);
  const second = safeCountdown > 0.4 ? Math.ceil(safeCountdown) : 0;
  const style = second === 0 ? null : second > 1 ? 'short' : 'long';
  return {
    second,
    shouldWhistle: second > 0 && second !== previousSecond,
    style,
    cutoffMs: style === 'short' ? 180 : null,
  };
};
