export const resolveFacing = ({ attackDirection, playerX, opponentX, movement, currentFacing }) => {
  const goalDirection = attackDirection >= 0 ? 1 : -1;
  const hasPassedDefender = goalDirection > 0 ? playerX > opponentX : playerX < opponentX;

  if (!hasPassedDefender) return goalDirection;
  if (movement > 0) return 1;
  if (movement < 0) return -1;
  return currentFacing >= 0 ? 1 : -1;
};
