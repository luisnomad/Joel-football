export const DISC_HOCKEY_PREVIEW_TEXTURE = 'disc-hockey-arena-neon';
export const DISC_HOCKEY_PREVIEW_ASSET = 'themes/neon-arena-v1.webp';

export const discHockeyAssetUrl = (filename) => (
  `${import.meta.env.BASE_URL}assets/minigames/disc-hockey/${filename}`
);

export const queueDiscHockeyPreview = (scene) => {
  if (scene.textures.exists(DISC_HOCKEY_PREVIEW_TEXTURE)) return false;
  scene.load.image(
    DISC_HOCKEY_PREVIEW_TEXTURE,
    discHockeyAssetUrl(DISC_HOCKEY_PREVIEW_ASSET),
  );
  return true;
};
