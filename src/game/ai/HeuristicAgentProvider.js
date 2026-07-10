import { predictBallXAtHeight, isBallApproaching } from '../pure/prediction.js';
import { clamp } from '../pure/actions.js';

const signDeadzone = (value, deadzone = 16) =>
  Math.abs(value) <= deadzone ? 0 : Math.sign(value);

export const decideHeuristicIntent = (snapshot, side = 'right') => {
  const self = snapshot.players[side];
  const opponent = snapshot.players[side === 'right' ? 'left' : 'right'];
  const ball = snapshot.ball;
  const directionToOpponent = Math.sign(opponent.x - self.x) || (side === 'right' ? -1 : 1);
  const predictedX = predictBallXAtHeight(ball);
  const ownGoalX = side === 'right' ? 1154 : 126;
  const defensiveAnchor = side === 'right' ? 1000 : 280;
  const approaching = isBallApproaching(ball, side);
  const ballDistance = Math.hypot(ball.x - self.x, ball.y - self.y);
  const ballInOwnHalf = side === 'right' ? ball.x > 640 : ball.x < 640;
  const emergency = approaching && Math.abs(ball.x - ownGoalX) < 300;

  let targetX = defensiveAnchor;
  if (ballInOwnHalf || emergency) {
    targetX = clamp(predictedX, side === 'right' ? 720 : 130, side === 'right' ? 1140 : 560);
  } else if (ball.y > 500) {
    targetX = clamp(ball.x + (side === 'right' ? 52 : -52), 150, 1130);
  }

  const aerialThreat = approaching && ball.y < self.y - 42 && Math.abs(ball.x - self.x) < 145;
  const counterThreat = snapshot.powerBall.active && snapshot.powerBall.owner !== side && ballDistance < 150;
  const strikeRange = ballDistance < 112 && Math.abs(ball.y - self.y) < 105;
  const opponentPressure = Math.abs(opponent.x - self.x) < 116;
  const defenderBlocksLane = Math.abs(opponent.x - self.x) < 245 && ball.y > self.y - 58;
  const shouldLob = strikeRange && self.grounded && defenderBlocksLane && !counterThreat;

  return {
    move: signDeadzone(targetX - self.x),
    jump: self.grounded && (aerialThreat || (emergency && ball.y < 500)),
    kick: !shouldLob && ((strikeRange && (ball.y > self.y - 92 || counterThreat)) || (counterThreat && ballDistance < 165)),
    lob: shouldLob,
    dash: self.dashCooldown <= 0 && opponentPressure && !emergency && directionToOpponent === Math.sign(opponent.x - self.x),
    power: self.meter >= 100 && strikeRange && (ballInOwnHalf || ball.y > 515),
  };
};

export const createHeuristicAgentProvider = (side = 'right') => ({
  id: 'heuristic-v1',
  decide: (snapshot) => decideHeuristicIntent(snapshot, side),
});
