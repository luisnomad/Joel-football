const degreesToRadians = (degrees) => (Number(degrees) || 0) * Math.PI / 180;

export const getSourcePointWorldPosition = ({
  x = 0,
  y = 0,
  displayOriginX = 0,
  displayOriginY = 0,
  scaleX = 1,
  scaleY = 1,
  angle = 0,
  flipX = false,
  sourceX = 0,
  sourceY = 0,
} = {}) => {
  const radians = degreesToRadians(angle);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const localX = (Number(sourceX) - Number(displayOriginX))
    * (Number(scaleX) || 0)
    * (flipX ? -1 : 1);
  const localY = (Number(sourceY) - Number(displayOriginY)) * (Number(scaleY) || 0);
  return {
    x: Number(x) + localX * cosine - localY * sine,
    y: Number(y) + localX * sine + localY * cosine,
  };
};

export const getSpriteSourcePointWorldPosition = (sprite, sourceX, sourceY) => (
  getSourcePointWorldPosition({
    x: sprite?.x,
    y: sprite?.y,
    displayOriginX: sprite?.displayOriginX,
    displayOriginY: sprite?.displayOriginY,
    scaleX: sprite?.scaleX,
    scaleY: sprite?.scaleY,
    angle: sprite?.angle,
    flipX: sprite?.flipX,
    sourceX,
    sourceY,
  })
);

/**
 * Synchronizes a display-only sprite with an invisible Matter sprite while
 * pinning one authored source point to an explicit world point. Scaling and
 * rotation therefore happen around the declared anchor instead of moving it.
 */
export const syncCharacterVisual = ({
  physicsSprite,
  visualSprite,
  frame = physicsSprite?.frame?.name,
  flipX = physicsSprite?.flipX,
  scaleX = visualSprite?.scaleX ?? 1,
  scaleY = visualSprite?.scaleY ?? 1,
  angle = 0,
  sourceAnchorX = (visualSprite?.width ?? 0) / 2,
  sourceAnchorY = 0,
  targetAnchorX = physicsSprite?.x ?? 0,
  targetAnchorY = physicsSprite?.body?.bounds?.max?.y ?? physicsSprite?.y ?? 0,
} = {}) => {
  if (!physicsSprite || !visualSprite) return null;
  if (frame !== undefined && visualSprite.frame?.name !== frame) visualSprite.setFrame(frame);
  visualSprite.setFlipX(Boolean(flipX));
  visualSprite.setScale(scaleX, scaleY);
  visualSprite.setAngle(angle);

  const anchorOffset = getSourcePointWorldPosition({
    x: 0,
    y: 0,
    displayOriginX: visualSprite.displayOriginX,
    displayOriginY: visualSprite.displayOriginY,
    scaleX: visualSprite.scaleX,
    scaleY: visualSprite.scaleY,
    angle: visualSprite.angle,
    flipX: visualSprite.flipX,
    sourceX: sourceAnchorX,
    sourceY: sourceAnchorY,
  });
  visualSprite.setPosition(
    Number(targetAnchorX) - anchorOffset.x,
    Number(targetAnchorY) - anchorOffset.y,
  );
  return { x: Number(targetAnchorX), y: Number(targetAnchorY) };
};
