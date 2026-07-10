export const fitTextSize = ({ measuredWidth, maxWidth, baseSize, minSize = 12 }) => {
  const safeBase = Math.max(1, Number(baseSize) || 1);
  const safeMinimum = Math.min(safeBase, Math.max(1, Number(minSize) || 1));
  const width = Math.max(0, Number(measuredWidth) || 0);
  const available = Math.max(1, Number(maxWidth) || 1);
  if (width <= available) return safeBase;
  return Math.max(safeMinimum, Math.floor(safeBase * (available / width)));
};
