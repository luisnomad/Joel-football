import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y } from '../constants.js';
import { getSceneStageLayout } from '../layout/tabletStage.js';
import { getArenaTheme } from '../content/matchCustomization.js';
import { playerProfileStore } from '../services/PlayerProfile.js';

const ensureFloorTexture = (scene, theme) => {
  const floorTextureKey = `arena-floor-band-${theme.id}`;
  if (scene.textures.exists(floorTextureKey)) return floorTextureKey;
  const source = scene.textures.get(theme.texture).getSourceImage();
  const sourceY = Math.round((GROUND_Y / GAME_HEIGHT) * source.height);
  const sourceBandHeight = Math.max(1, source.height - sourceY);
  const logicalBandHeight = GAME_HEIGHT - GROUND_Y;
  const texture = scene.textures.createCanvas(floorTextureKey, GAME_WIDTH, logicalBandHeight);
  texture.getContext().drawImage(
    source,
    0,
    sourceY,
    source.width,
    sourceBandHeight,
    0,
    0,
    GAME_WIDTH,
    logicalBandHeight,
  );
  texture.refresh();
  return floorTextureKey;
};

export const createArenaStage = (scene, { depth = 0, themeId = null } = {}) => {
  const layout = getSceneStageLayout(scene);
  const theme = getArenaTheme(themeId ?? playerProfileStore.get().arenaThemeId);
  const horizontalOverflow = Math.max(0, layout.width - GAME_WIDTH);
  const horizontalOffset = horizontalOverflow / 2;
  if (horizontalOverflow >= 24) scene.cameras.main.setScroll(-horizontalOffset, 0);
  const arena = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, theme.texture)
    .setDisplaySize(GAME_WIDTH + horizontalOverflow, GAME_HEIGHT)
    .setDepth(depth);
  const extension = [];
  if (!layout.extended) return { arena, extension, treatment: null, theme, layout };

  const floorTextureKey = ensureFloorTexture(scene, theme);
  const floorBandHeight = GAME_HEIGHT - GROUND_Y;
  let remainingHeight = layout.extraHeight;
  let bandTop = GAME_HEIGHT;
  let bandIndex = 0;

  while (remainingHeight > 0) {
    const bandHeight = Math.min(floorBandHeight, remainingHeight);
    const floorBand = scene.add.image(0, bandTop + (bandHeight / 2), floorTextureKey)
      .setOrigin(0, 0.5)
      .setDisplaySize(GAME_WIDTH, bandHeight)
      .setFlipY(bandIndex % 2 === 0)
      .setDepth(depth);
    extension.push(floorBand);
    bandTop += bandHeight;
    remainingHeight -= bandHeight;
    bandIndex += 1;
  }

  const seam = scene.add.graphics().setDepth(depth + 0.01);
  seam.lineStyle(3, 0x55cfe0, 0.2).lineBetween(0, GAME_HEIGHT, GAME_WIDTH, GAME_HEIGHT);
  extension.push(seam);
  return { arena, extension, treatment: null, theme, layout };
};
