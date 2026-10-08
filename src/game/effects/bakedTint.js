/**
 * Canvas-renderer replacements for setTint / setTintFill. The game runs Phaser
 * in CANVAS mode, where tints are silently ignored, so a coloured copy of the
 * texture frame is baked once into its own canvas texture and swapped in.
 *
 *   mode 'multiply' ≈ setTint(color)     (keeps shading, colours the art)
 *   mode 'fill'     ≈ setTintFill(color) (solid silhouette in `color`)
 */
export const bakedTintKey = (textureKey, frameName, color, mode) => {
  const frame = frameName === undefined || frameName === null || frameName === '__BASE' ? '' : `:${frameName}`;
  return `${textureKey}${frame}~${mode}-${(color >>> 0).toString(16).padStart(6, '0')}`;
};

const cssColor = (color) => `#${(color >>> 0).toString(16).padStart(6, '0').slice(-6)}`;

/** Returns the key of a baked copy of `textureKey` (frame `frameName`) coloured by `color`. */
export const bakeTintedTexture = (scene, textureKey, color, { mode = 'multiply', frameName } = {}) => {
  const key = bakedTintKey(textureKey, frameName, color, mode);
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(textureKey);
  const frame = source.get(frameName);
  const width = Math.max(1, Math.round(frame.cutWidth));
  const height = Math.max(1, Math.round(frame.cutHeight));
  const canvas = scene.textures.createCanvas(key, width, height);
  const context = canvas.getContext();
  const image = frame.source.image;
  const draw = () => context.drawImage(image, frame.cutX, frame.cutY, width, height, 0, 0, width, height);
  draw();
  context.globalCompositeOperation = mode === 'fill' ? 'source-in' : 'multiply';
  context.fillStyle = cssColor(color);
  context.fillRect(0, 0, width, height);
  if (mode !== 'fill') {
    // `multiply` also paints transparent pixels; restore the art's alpha.
    context.globalCompositeOperation = 'destination-in';
    draw();
  }
  context.globalCompositeOperation = 'source-over';
  canvas.refresh();
  return key;
};

/**
 * Show `gameObject` coloured by `color` (or its original art when `color` is
 * null), keeping its frame and display size. Remembers the original texture.
 */
export const applyBakedTint = (gameObject, color, { mode = 'multiply' } = {}) => {
  if (!gameObject?.scene) return gameObject;
  if (!gameObject.bakedTintOriginal) {
    gameObject.bakedTintOriginal = { key: gameObject.texture.key, frame: gameObject.frame.name };
  }
  const original = gameObject.bakedTintOriginal;
  const width = gameObject.displayWidth;
  const height = gameObject.displayHeight;
  const targetKey = color === null || color === undefined
    ? original.key
    : bakeTintedTexture(gameObject.scene, original.key, color, { mode, frameName: original.frame });
  const targetFrame = targetKey === original.key ? original.frame : undefined;
  if (gameObject.texture.key !== targetKey) {
    gameObject.setTexture(targetKey, targetFrame);
    gameObject.setDisplaySize(width, height);
  }
  gameObject.bakedTint = color === null || color === undefined ? null : { color, mode };
  return gameObject;
};
