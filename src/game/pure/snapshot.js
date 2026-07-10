export const createWorldSnapshot = ({ score, ball, left, right, powerBall }) =>
  Object.freeze({
    coordinateSystem: 'origin top-left; +x right; +y down; pixels at 1280x720',
    score: Object.freeze({ ...score }),
    ball: Object.freeze({ ...ball }),
    players: Object.freeze({
      left: Object.freeze({ ...left }),
      right: Object.freeze({ ...right }),
    }),
    powerBall: Object.freeze({ ...powerBall }),
  });
