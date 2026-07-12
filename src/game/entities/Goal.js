import {
  CATEGORIES,
  CROSSBAR_HEIGHT,
  CROSSBAR_Y,
  GAME_WIDTH,
  GOAL_LINE_LEFT,
  GOAL_LINE_RIGHT,
  GROUND_Y,
} from '../constants.js';

export class Goal {
  constructor(scene, side) {
    this.scene = scene;
    this.side = side;
    const left = side === 'left';
    const goalLine = left ? GOAL_LINE_LEFT : GOAL_LINE_RIGHT;
    const horizontalOffset = Math.max(0, (scene.stageLayout?.width ?? GAME_WIDTH) - GAME_WIDTH) / 2;
    const imageWidth = 150 + horizontalOffset;
    const imageX = left
      ? 75 - horizontalOffset / 2
      : GAME_WIDTH - 75 + horizontalOffset / 2;
    this.image = scene.add.image(imageX, GROUND_Y, 'goal-side')
      .setDisplaySize(imageWidth, 270)
      .setOrigin(0.5, 1)
      .setFlipX(!left)
      .setDepth(10);

    const baseCrossbarWidth = left ? goalLine + 6 : GAME_WIDTH - goalLine + 6;
    const crossbarWidth = baseCrossbarWidth + horizontalOffset;
    const crossbarX = left
      ? (baseCrossbarWidth - horizontalOffset) / 2
      : GAME_WIDTH - baseCrossbarWidth / 2 + horizontalOffset / 2;
    this.crossbar = scene.matter.add.rectangle(crossbarX, CROSSBAR_Y, crossbarWidth, CROSSBAR_HEIGHT, {
      isStatic: true,
      label: `${side}-crossbar`,
      restitution: 0.88,
      friction: 0.02,
      collisionFilter: {
        category: CATEGORIES.GOAL,
        mask: CATEGORIES.BALL | CATEGORIES.PLAYER,
      },
    });
  }
}
