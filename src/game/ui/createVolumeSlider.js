import Phaser from 'phaser';

const normalize = (value) => Math.round(Phaser.Math.Clamp(Number(value) || 0, 0, 1) * 20) / 20;

export const createVolumeSlider = (scene, {
  x,
  y,
  width = 480,
  value = 0,
  color = 0x58e1ef,
  onChange = () => {},
}) => {
  const left = x - width / 2;
  const track = scene.add.rectangle(x, y, width, 14, 0x152b45, 1)
    .setStrokeStyle(2, 0xffffff, 0.18);
  const fill = scene.add.rectangle(left, y, 0, 14, color, 0.95).setOrigin(0, 0.5);
  const knob = scene.add.circle(left, y, 19, 0xf6fdff, 1)
    .setStrokeStyle(4, color, 0.75);
  const zone = scene.add.zone(x, y, width + 52, 62).setInteractive({ useHandCursor: true });
  let current = normalize(value);

  const render = () => {
    fill.width = width * current;
    knob.x = left + width * current;
  };

  const setValue = (next, notify = false) => {
    const normalized = normalize(next);
    if (normalized === current) return current;
    current = normalized;
    render();
    if (notify) onChange(current);
    return current;
  };

  const setFromPointer = (pointer) => {
    const pointerX = Number.isFinite(pointer.worldX) ? pointer.worldX : pointer.x;
    setValue((pointerX - left) / width, true);
  };

  zone.on('pointerdown', setFromPointer);
  zone.on('pointermove', (pointer) => {
    if (pointer.isDown) setFromPointer(pointer);
  });
  render();

  return Object.freeze({
    track,
    fill,
    knob,
    zone,
    getValue: () => current,
    setValue,
  });
};
