export const isTouchLayout = () => {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  return coarsePointer || touchPoints > 0 || window.innerWidth < 900;
};
