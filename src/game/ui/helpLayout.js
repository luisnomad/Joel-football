export const createHelpColumnLayout = ({
  panelX = 640,
  panelWidth = 890,
  badgeCenters = [350, 740],
  badgeRadius = 29,
  textOffset = 48,
  interColumnGap = 20,
  outerPadding = 32,
} = {}) => {
  const panelLeft = panelX - panelWidth / 2;
  const panelRight = panelX + panelWidth / 2;
  const columns = badgeCenters.map((badgeX, index) => {
    const textX = badgeX + textOffset;
    const textRight = index < badgeCenters.length - 1
      ? badgeCenters[index + 1] - badgeRadius - interColumnGap
      : panelRight - outerPadding;

    return {
      badgeX,
      textX,
      textRight,
      textWidth: Math.max(0, textRight - textX),
    };
  });

  return {
    panelLeft,
    panelRight,
    badgeRadius,
    interColumnGap,
    outerPadding,
    columns,
  };
};
